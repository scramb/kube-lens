package main

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func (m *KubeManager) GetResourceQuantities(group, version, resourceName, namespace string, names []string) ([]ResourceQuantityInfo, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resourceName}
	nameSet := map[string]bool{}
	for _, name := range names {
		if name != "" {
			nameSet[name] = true
		}
	}

	var list *unstructured.UnstructuredList
	if namespace != "" {
		list, err = dyn.Resource(gvr).Namespace(namespace).List(ctx, metav1ListOptions())
	} else {
		list, err = dyn.Resource(gvr).List(ctx, metav1ListOptions())
	}
	if err != nil {
		return nil, err
	}

	out := make([]ResourceQuantityInfo, 0, len(list.Items))
	for i := range list.Items {
		item := &list.Items[i]
		if len(nameSet) > 0 && !nameSet[item.GetName()] {
			continue
		}
		summary, ok := quantitySummaryForObject(resourceName, item.Object)
		if !ok {
			continue
		}
		out = append(out, ResourceQuantityInfo{Namespace: item.GetNamespace(), Name: item.GetName(), Summary: summary})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (m *KubeManager) GetResourceQuantity(group, version, resourceName, namespace, name string) (ResourceQuantitySummary, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return ResourceQuantitySummary{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resourceName}
	item, err := dyn.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1GetOptions())
	if err != nil {
		return ResourceQuantitySummary{}, err
	}
	summary, ok := quantitySummaryForObject(resourceName, item.Object)
	if !ok {
		return ResourceQuantitySummary{}, fmt.Errorf("resource %s does not have a pod template", resourceName)
	}
	return summary, nil
}

func metav1ListOptions() metav1.ListOptions { return metav1.ListOptions{} }
func metav1GetOptions() metav1.GetOptions   { return metav1.GetOptions{} }

func quantitySummaryForObject(resourceName string, obj map[string]any) (ResourceQuantitySummary, bool) {
	if resourceName == "pods" {
		podSpec, ok := nestedMap(obj, "spec")
		if !ok {
			return ResourceQuantitySummary{}, false
		}
		return quantitySummaryForPodSpec(podSpec), true
	}

	if resourceName == "deployments" || resourceName == "statefulsets" || resourceName == "daemonsets" || resourceName == "replicasets" {
		podSpec, ok := nestedMap(obj, "spec", "template", "spec")
		if !ok {
			return ResourceQuantitySummary{}, false
		}
		return quantitySummaryForPodSpec(podSpec), true
	}

	return ResourceQuantitySummary{}, false
}

func quantitySummaryForPodSpec(spec map[string]any) ResourceQuantitySummary {
	app := sumContainers(mustSlice(spec["containers"]))
	init := maxInitContainers(mustSlice(spec["initContainers"]))
	return maxSummaries(app, init)
}

func sumContainers(containers []any) ResourceQuantitySummary {
	var out ResourceQuantitySummary
	for _, raw := range containers {
		container, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		addContainerResources(&out, container)
	}
	return out
}

func maxInitContainers(containers []any) ResourceQuantitySummary {
	var out ResourceQuantitySummary
	for _, raw := range containers {
		container, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		var current ResourceQuantitySummary
		addContainerResources(&current, container)
		out = maxSummaries(out, current)
	}
	return out
}

func maxSummaries(a, b ResourceQuantitySummary) ResourceQuantitySummary {
	return ResourceQuantitySummary{
		CPURequest:    maxIfPresent(a.CPURequest, a.HasCPURequest, b.CPURequest, b.HasCPURequest),
		CPULimit:      maxIfPresent(a.CPULimit, a.HasCPULimit, b.CPULimit, b.HasCPULimit),
		MemoryRequest: maxIfPresent(a.MemoryRequest, a.HasMemRequest, b.MemoryRequest, b.HasMemRequest),
		MemoryLimit:   maxIfPresent(a.MemoryLimit, a.HasMemLimit, b.MemoryLimit, b.HasMemLimit),
		HasCPURequest: a.HasCPURequest || b.HasCPURequest,
		HasCPULimit:   a.HasCPULimit || b.HasCPULimit,
		HasMemRequest: a.HasMemRequest || b.HasMemRequest,
		HasMemLimit:   a.HasMemLimit || b.HasMemLimit,
	}
}

func maxIfPresent(a float64, hasA bool, b float64, hasB bool) float64 {
	if !hasA {
		return b
	}
	if !hasB {
		return a
	}
	return math.Max(a, b)
}

func addContainerResources(out *ResourceQuantitySummary, container map[string]any) {
	requests, _ := nestedMap(container, "resources", "requests")
	limits, _ := nestedMap(container, "resources", "limits")
	if v, ok := cpuQuantity(requests["cpu"]); ok {
		out.CPURequest += v
		out.HasCPURequest = true
	}
	if v, ok := cpuQuantity(limits["cpu"]); ok {
		out.CPULimit += v
		out.HasCPULimit = true
	}
	if v, ok := memoryQuantity(requests["memory"]); ok {
		out.MemoryRequest += v
		out.HasMemRequest = true
	}
	if v, ok := memoryQuantity(limits["memory"]); ok {
		out.MemoryLimit += v
		out.HasMemLimit = true
	}
}

func cpuQuantity(raw any) (float64, bool) {
	text, ok := raw.(string)
	if !ok || text == "" {
		return 0, false
	}
	q, err := resource.ParseQuantity(text)
	if err != nil {
		return 0, false
	}
	return float64(q.MilliValue()) / 1000, true
}

func memoryQuantity(raw any) (float64, bool) {
	text, ok := raw.(string)
	if !ok || text == "" {
		return 0, false
	}
	q, err := resource.ParseQuantity(text)
	if err != nil {
		return 0, false
	}
	return float64(q.Value()), true
}

func nestedMap(obj map[string]any, path ...string) (map[string]any, bool) {
	current := obj
	for _, key := range path {
		next, ok := current[key].(map[string]any)
		if !ok {
			return nil, false
		}
		current = next
	}
	return current, true
}

func mustSlice(raw any) []any {
	items, _ := raw.([]any)
	return items
}
