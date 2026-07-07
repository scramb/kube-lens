package main

import (
	"context"
	"encoding/json"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// PatchResource applies a patch to a single object. patchType selects the
// strategy: "merge", "strategic", or "json"; anything else falls back to merge.
func (m *KubeManager) PatchResource(group, version, resource, namespace, name, patchJSON, patchType string) error {
	_, dyn, _, err := m.clients()
	if err != nil {
		return err
	}

	var ptype types.PatchType
	switch patchType {
	case "strategic":
		ptype = types.StrategicMergePatchType
	case "json":
		ptype = types.JSONPatchType
	default:
		ptype = types.MergePatchType
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	if namespace != "" {
		_, err = dyn.Resource(gvr).Namespace(namespace).Patch(ctx, name, ptype, []byte(patchJSON), metav1.PatchOptions{})
	} else {
		_, err = dyn.Resource(gvr).Patch(ctx, name, ptype, []byte(patchJSON), metav1.PatchOptions{})
	}
	return err
}

// AnnotateResource sets a single annotation via a merge patch.
func (m *KubeManager) AnnotateResource(group, version, resource, namespace, name, key, value string) error {
	patch := map[string]any{
		"metadata": map[string]any{
			"annotations": map[string]string{
				key: value,
			},
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	return m.PatchResource(group, version, resource, namespace, name, string(data), "merge")
}

// SetSuspend toggles spec.suspend via a merge patch.
func (m *KubeManager) SetSuspend(group, version, resource, namespace, name string, suspended bool) error {
	patch := map[string]any{
		"spec": map[string]any{
			"suspend": suspended,
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	return m.PatchResource(group, version, resource, namespace, name, string(data), "merge")
}

// ---------- App wrappers ----------

func (a *App) PatchResource(group, version, resource, namespace, name, patchJSON, patchType string) error {
	return a.kube.PatchResource(group, version, resource, namespace, name, patchJSON, patchType)
}

func (a *App) AnnotateResource(group, version, resource, namespace, name, key, value string) error {
	return a.kube.AnnotateResource(group, version, resource, namespace, name, key, value)
}

func (a *App) SetSuspend(group, version, resource, namespace, name string, suspended bool) error {
	return a.kube.SetSuspend(group, version, resource, namespace, name, suspended)
}
