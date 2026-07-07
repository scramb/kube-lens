package main

import (
	"context"
	"encoding/json"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// EventInfo is a flattened core/v1 Event exposed to the frontend.
type EventInfo struct {
	Type           string `json:"type"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
	Count          int64  `json:"count"`
	Source         string `json:"source"`
	FirstTimestamp string `json:"firstTimestamp"`
	LastTimestamp  string `json:"lastTimestamp"`
}

// GetResourceJSON returns the full manifest as indented JSON (managedFields stripped).
func (m *KubeManager) GetResourceJSON(group, version, resource, namespace, name string) (string, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return "", err
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
		return "", err
	}
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")
	data, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetEventsFor lists core/v1 Events that reference the given object, newest first.
func (m *KubeManager) GetEventsFor(namespace, name, uid string) ([]EventInfo, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	gvr := schema.GroupVersionResource{Version: "v1", Resource: "events"}

	selectors := []string{"involvedObject.name=" + name}
	if namespace != "" {
		selectors = append(selectors, "involvedObject.namespace="+namespace)
	}
	if uid != "" {
		selectors = append(selectors, "involvedObject.uid="+uid)
	}
	sel := ""
	for i, s := range selectors {
		if i > 0 {
			sel += ","
		}
		sel += s
	}

	opts := metav1.ListOptions{FieldSelector: sel}
	var list *unstructured.UnstructuredList
	if namespace != "" {
		list, err = dyn.Resource(gvr).Namespace(namespace).List(ctx, opts)
	} else {
		list, err = dyn.Resource(gvr).List(ctx, opts)
	}
	if err != nil {
		return nil, err
	}

	events := make([]EventInfo, 0, len(list.Items))
	for _, item := range list.Items {
		obj := item.Object

		typ, _, _ := unstructured.NestedString(obj, "type")
		reason, _, _ := unstructured.NestedString(obj, "reason")
		message, _, _ := unstructured.NestedString(obj, "message")
		count, _, _ := unstructured.NestedInt64(obj, "count")

		source, _, _ := unstructured.NestedString(obj, "source", "component")
		if source == "" {
			source, _, _ = unstructured.NestedString(obj, "reportingComponent")
		}

		first, _, _ := unstructured.NestedString(obj, "firstTimestamp")
		last, _, _ := unstructured.NestedString(obj, "lastTimestamp")
		if last == "" {
			last, _, _ = unstructured.NestedString(obj, "eventTime")
		}

		events = append(events, EventInfo{
			Type:           typ,
			Reason:         reason,
			Message:        message,
			Count:          count,
			Source:         source,
			FirstTimestamp: first,
			LastTimestamp:  last,
		})
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].LastTimestamp > events[j].LastTimestamp
	})

	return events, nil
}

// ---------- App wrappers ----------

func (a *App) GetResourceJSON(group, version, resource, namespace, name string) (string, error) {
	return a.kube.GetResourceJSON(group, version, resource, namespace, name)
}

func (a *App) GetEventsFor(namespace, name, uid string) ([]EventInfo, error) {
	return a.kube.GetEventsFor(namespace, name, uid)
}
