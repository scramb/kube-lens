package main

import (
	"context"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// reconcileAnnotation is the trigger Flux watches for on-demand reconciliation —
// identical to what `flux reconcile` writes.
const reconcileAnnotation = "reconcile.fluxcd.io/requestedAt"

// FluxKindStatus aggregates the health of one Flux resource type.
type FluxKindStatus struct {
	Kind      string `json:"kind"`
	Group     string `json:"group"`
	Version   string `json:"version"`
	Resource  string `json:"resource"`
	Total     int    `json:"total"`
	Ready     int    `json:"ready"`
	NotReady  int    `json:"notReady"`
	Suspended int    `json:"suspended"`
}

type FluxProblemResource struct {
	Kind      string `json:"kind"`
	Group     string `json:"group"`
	Version   string `json:"version"`
	Resource  string `json:"resource"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
	Message   string `json:"message"`
	Age       string `json:"age"`
	Revision  string `json:"revision"`
	Suspended bool   `json:"suspended"`
}

// fluxResources returns all discovered API resources in *.fluxcd.io groups.
func (m *KubeManager) fluxResources() ([]APIResource, error) {
	all, err := m.DiscoverResources()
	if err != nil {
		return nil, err
	}
	var out []APIResource
	for _, r := range all {
		if strings.HasSuffix(r.Group, ".fluxcd.io") {
			out = append(out, r)
		}
	}
	return out, nil
}

func isSuspended(obj map[string]any) bool {
	v, found, err := unstructured.NestedBool(obj, "spec", "suspend")
	return found && err == nil && v
}

func readyCondition(obj map[string]any) (status, reason, message string, found bool) {
	conds, found, err := unstructured.NestedSlice(obj, "status", "conditions")
	if !found || err != nil {
		return "", "", "", false
	}
	for _, c := range conds {
		cm, ok := c.(map[string]any)
		if !ok {
			continue
		}
		if cm["type"] == "Ready" {
			status, _ = cm["status"].(string)
			reason, _ = cm["reason"].(string)
			message, _ = cm["message"].(string)
			return status, reason, message, true
		}
	}
	return "", "", "", false
}

func isReady(obj map[string]any) bool {
	status, _, _, found := readyCondition(obj)
	return found && status == "True"
}

func fluxRevision(obj map[string]any) string {
	for _, path := range [][]string{
		{"status", "lastAppliedRevision"},
		{"status", "lastAttemptedRevision"},
		{"status", "artifact", "revision"},
		{"status", "lastHandledReconcileAt"},
	} {
		if v, found, err := unstructured.NestedString(obj, path...); found && err == nil && v != "" {
			return v
		}
	}
	return ""
}

// FluxStatus lists every Flux resource type and counts ready / not-ready /
// suspended instances across all namespaces.
func (m *KubeManager) FluxProblemResources() ([]FluxProblemResource, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	resources, err := m.fluxResources()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	out := []FluxProblemResource{}
	for _, r := range resources {
		gvr := schema.GroupVersionResource{Group: r.Group, Version: r.Version, Resource: r.Name}
		list, err := dyn.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}
		for _, item := range list.Items {
			status, reason, message, found := readyCondition(item.Object)
			suspended := isSuspended(item.Object)
			if suspended || (found && status == "True") {
				continue
			}
			if !found {
				status = "Unknown"
			}
			out = append(out, FluxProblemResource{
				Kind:      r.Kind,
				Group:     r.Group,
				Version:   r.Version,
				Resource:  r.Name,
				Namespace: item.GetNamespace(),
				Name:      item.GetName(),
				Status:    status,
				Reason:    reason,
				Message:   message,
				Age:       humanAge(item.GetCreationTimestamp().Time),
				Revision:  fluxRevision(item.Object),
				Suspended: suspended,
			})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (m *KubeManager) FluxStatus() ([]FluxKindStatus, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	resources, err := m.fluxResources()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	out := make([]FluxKindStatus, 0, len(resources))
	for _, r := range resources {
		gvr := schema.GroupVersionResource{Group: r.Group, Version: r.Version, Resource: r.Name}
		list, err := dyn.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}
		st := FluxKindStatus{Kind: r.Kind, Group: r.Group, Version: r.Version, Resource: r.Name}
		for _, item := range list.Items {
			st.Total++
			if isSuspended(item.Object) {
				st.Suspended++
				continue
			}
			if isReady(item.Object) {
				st.Ready++
			} else {
				st.NotReady++
			}
		}
		out = append(out, st)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Kind < out[j].Kind })
	return out, nil
}

// FluxReconcile requests an immediate reconciliation by stamping the
// reconcile annotation (same mechanism as `flux reconcile`).
func (m *KubeManager) FluxReconcile(group, version, resource, namespace, name string) error {
	ts := time.Now().Format(time.RFC3339Nano)
	return m.AnnotateResource(group, version, resource, namespace, name, reconcileAnnotation, ts)
}

// resolveFluxGVR finds the group/version/plural for a Flux source Kind
// (e.g. "GitRepository") from discovery.
func (m *KubeManager) resolveFluxGVR(kind string) (group, version, resource string, ok bool) {
	res, err := m.fluxResources()
	if err != nil {
		return "", "", "", false
	}
	for _, r := range res {
		if r.Kind == kind {
			return r.Group, r.Version, r.Name, true
		}
	}
	return "", "", "", false
}

// extractSourceRef pulls the referenced source (kind/name/namespace) from a
// Flux object, covering Kustomization (spec.sourceRef), HelmRelease with
// spec.chartRef, and HelmRelease with the classic spec.chart.spec.sourceRef.
func extractSourceRef(obj map[string]any, defaultNS string) (kind, name, namespace string) {
	pick := func(path ...string) (string, string, string, bool) {
		ref, found, err := unstructured.NestedMap(obj, path...)
		if !found || err != nil {
			return "", "", "", false
		}
		k, _ := ref["kind"].(string)
		n, _ := ref["name"].(string)
		ns, _ := ref["namespace"].(string)
		if k == "" || n == "" {
			return "", "", "", false
		}
		return k, n, ns, true
	}
	for _, path := range [][]string{
		{"spec", "sourceRef"},
		{"spec", "chartRef"},
		{"spec", "chart", "spec", "sourceRef"},
	} {
		if k, n, ns, found := pick(path...); found {
			if ns == "" {
				ns = defaultNS
			}
			return k, n, ns
		}
	}
	return "", "", ""
}

// FluxReconcileWithSource reconciles the referenced source first, then the
// resource itself — mirrors `flux reconcile ... --with-source`.
func (m *KubeManager) FluxReconcileWithSource(group, version, resource, namespace, name string) error {
	_, dyn, _, err := m.clients()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	obj, err := dyn.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if k, n, ns := extractSourceRef(obj.Object, namespace); k != "" {
		if sg, sv, sr, ok := m.resolveFluxGVR(k); ok {
			// Best effort — don't fail the whole action if the source can't be stamped.
			_ = m.FluxReconcile(sg, sv, sr, ns, n)
		}
	}
	return m.FluxReconcile(group, version, resource, namespace, name)
}
