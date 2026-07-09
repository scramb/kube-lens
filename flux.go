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

type FluxOwnership struct {
	Managed        bool   `json:"managed"`
	OwnerKind      string `json:"ownerKind"`
	OwnerName      string `json:"ownerName"`
	OwnerNamespace string `json:"ownerNamespace"`
	OwnerFound     bool   `json:"ownerFound"`
	OwnerSuspended bool   `json:"ownerSuspended"`
	OwnerGroup     string `json:"ownerGroup"`
	OwnerVersion   string `json:"ownerVersion"`
	OwnerResource  string `json:"ownerResource"`
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

type fluxResourcePredicate func(obj map[string]any, readyStatus string, readyFound bool, suspended bool) bool

func (m *KubeManager) collectFluxResources(predicate fluxResourcePredicate) ([]FluxProblemResource, error) {
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
			if !predicate(item.Object, status, found, suspended) {
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

// FluxProblemResources returns Flux resources that are failed/not-ready. Suspended
// resources with Ready!=True intentionally still appear here; Suspended itself is
// shown separately and is not the reason a resource is considered a problem.
func fluxProblemPredicate(_ map[string]any, status string, found bool, _ bool) bool {
	return !(found && status == "True")
}

func fluxSuspendedPredicate(_ map[string]any, _ string, _ bool, suspended bool) bool {
	return suspended
}

func (m *KubeManager) FluxProblemResources() ([]FluxProblemResource, error) {
	return m.collectFluxResources(fluxProblemPredicate)
}

// FluxSuspendedResources returns Flux resources with spec.suspend=true. A resource
// can be both suspended and not ready; in that case it intentionally appears here
// and in the problems overview.
func (m *KubeManager) FluxSuspendedResources() ([]FluxProblemResource, error) {
	return m.collectFluxResources(fluxSuspendedPredicate)
}

func fluxOwnershipFromLabels(labels map[string]string) FluxOwnership {
	if labels == nil {
		return FluxOwnership{}
	}
	pick := func(kind, group, nameLabel, namespaceLabel, resource string) (FluxOwnership, bool) {
		name := strings.TrimSpace(labels[nameLabel])
		namespace := strings.TrimSpace(labels[namespaceLabel])
		if name == "" || namespace == "" {
			return FluxOwnership{}, false
		}
		return FluxOwnership{
			Managed:        true,
			OwnerKind:      kind,
			OwnerName:      name,
			OwnerNamespace: namespace,
			OwnerGroup:     group,
			OwnerResource:  resource,
		}, true
	}
	// HelmRelease is the more direct owner if both controller label sets exist.
	if owner, ok := pick("HelmRelease", "helm.toolkit.fluxcd.io", "helm.toolkit.fluxcd.io/name", "helm.toolkit.fluxcd.io/namespace", "helmreleases"); ok {
		return owner
	}
	if owner, ok := pick("Kustomization", "kustomize.toolkit.fluxcd.io", "kustomize.toolkit.fluxcd.io/name", "kustomize.toolkit.fluxcd.io/namespace", "kustomizations"); ok {
		return owner
	}
	return FluxOwnership{}
}

func (m *KubeManager) GetFluxOwnership(group, version, resource, namespace, name string) (FluxOwnership, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return FluxOwnership{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	var obj *unstructured.Unstructured
	if namespace != "" {
		obj, err = dyn.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		obj, err = dyn.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}
	if err != nil {
		return FluxOwnership{}, err
	}

	ownership := fluxOwnershipFromLabels(obj.GetLabels())
	if !ownership.Managed {
		return ownership, nil
	}
	if ownerGroup, ownerVersion, ownerResource, ok := m.resolveFluxGVR(ownership.OwnerKind); ok {
		ownership.OwnerGroup = ownerGroup
		ownership.OwnerVersion = ownerVersion
		ownership.OwnerResource = ownerResource
	}
	if ownership.OwnerGroup == "" || ownership.OwnerVersion == "" || ownership.OwnerResource == "" {
		return ownership, nil
	}

	ownerGVR := schema.GroupVersionResource{Group: ownership.OwnerGroup, Version: ownership.OwnerVersion, Resource: ownership.OwnerResource}
	owner, err := dyn.Resource(ownerGVR).Namespace(ownership.OwnerNamespace).Get(ctx, ownership.OwnerName, metav1.GetOptions{})
	if err != nil {
		ownership.OwnerFound = false
		return ownership, nil
	}
	ownership.OwnerFound = true
	ownership.OwnerSuspended = isSuspended(owner.Object)
	return ownership, nil
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
