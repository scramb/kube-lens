package main

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/restmapper"
	sigsyaml "sigs.k8s.io/yaml"
)

// ApplyResult is the outcome of a Server-Side Apply operation, returned to the
// frontend. On dryRun the YAML holds the server-validated result.
type ApplyResult struct {
	OK        bool   `json:"ok"`
	Message   string `json:"message"`
	Group     string `json:"group"`
	Version   string `json:"version"`
	Resource  string `json:"resource"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	YAML      string `json:"yaml"` // resultierendes Objekt als YAML (bei dryRun das validierte Ergebnis)
}

const applyFieldManager = "kube-lens"

// ApplyResourceYAML applies a single manifest via Kubernetes Server-Side Apply.
// The GVK is read from the manifest and resolved to a GVR through the cluster's
// discovery-backed RESTMapper. When dryRun is set the server validates without
// persisting. force takes ownership of conflicting fields.
func (m *KubeManager) ApplyResourceYAML(yamlStr string, dryRun bool, force bool) (ApplyResult, error) {
	// Parse YAML -> unstructured object. sigs.k8s.io/yaml understands YAML and
	// unmarshals into the same shape as JSON.
	raw := map[string]interface{}{}
	if err := sigsyaml.Unmarshal([]byte(yamlStr), &raw); err != nil {
		return ApplyResult{}, fmt.Errorf("YAML konnte nicht gelesen werden: %w", err)
	}
	obj := &unstructured.Unstructured{Object: raw}

	apiVersion := obj.GetAPIVersion()
	kind := obj.GetKind()
	if apiVersion == "" || kind == "" {
		return ApplyResult{}, fmt.Errorf("apiVersion und kind erforderlich")
	}

	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("ungültige apiVersion %q: %w", apiVersion, err)
	}
	gvk := gv.WithKind(kind)

	disc, dyn, _, err := m.clients()
	if err != nil {
		return ApplyResult{}, err
	}

	// Resolve GVK -> GVR + scope via the discovery-backed RESTMapper.
	grs, err := restmapper.GetAPIGroupResources(disc)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("API-Ressourcen konnten nicht ermittelt werden: %w", err)
	}
	mapper := restmapper.NewDiscoveryRESTMapper(grs)
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("Ressourcentyp %s konnte nicht aufgelöst werden: %w", gvk.String(), err)
	}
	gvr := mapping.Resource
	namespaced := mapping.Scope.Name() == meta.RESTScopeNameNamespace

	name := obj.GetName()
	if name == "" {
		return ApplyResult{}, fmt.Errorf("metadata.name erforderlich")
	}

	ns := obj.GetNamespace()
	if namespaced && ns == "" {
		ns = "default"
		obj.SetNamespace(ns)
	}
	if !namespaced {
		ns = ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	opts := metav1.ApplyOptions{FieldManager: applyFieldManager, Force: force}
	if dryRun {
		opts.DryRun = []string{metav1.DryRunAll}
	}

	var res *unstructured.Unstructured
	ri := dyn.Resource(gvr)
	if namespaced {
		res, err = ri.Namespace(ns).Apply(ctx, name, obj, opts)
	} else {
		res, err = ri.Apply(ctx, name, obj, opts)
	}
	if err != nil {
		return ApplyResult{
			OK:        false,
			Message:   err.Error(),
			Group:     gvr.Group,
			Version:   gvr.Version,
			Resource:  gvr.Resource,
			Kind:      kind,
			Namespace: ns,
			Name:      name,
		}, err
	}

	// Strip managedFields from the returned object before rendering YAML.
	unstructured.RemoveNestedField(res.Object, "metadata", "managedFields")
	yamlOut, err := sigsyaml.Marshal(res.Object)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("Ergebnis konnte nicht serialisiert werden: %w", err)
	}

	message := "Angewendet"
	if dryRun {
		message = "Dry-Run erfolgreich"
	}

	return ApplyResult{
		OK:        true,
		Message:   message,
		Group:     gvr.Group,
		Version:   gvr.Version,
		Resource:  gvr.Resource,
		Kind:      kind,
		Namespace: ns,
		Name:      name,
		YAML:      string(yamlOut),
	}, nil
}

// ApplyResourceYAML is the Wails binding wrapper for the frontend.
func (a *App) ApplyResourceYAML(yamlStr string, dryRun bool, force bool) (ApplyResult, error) {
	return a.kube.ApplyResourceYAML(yamlStr, dryRun, force)
}
