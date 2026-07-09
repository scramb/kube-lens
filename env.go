package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

type PodEnvironment struct {
	Entries  []PodEnvironmentEntry `json:"entries"`
	Warnings []string              `json:"warnings"`
}

type PodEnvironmentEntry struct {
	ContainerType string `json:"containerType"`
	Container     string `json:"container"`
	Name          string `json:"name"`
	Value         string `json:"value"`
	Source        string `json:"source"`
	RefName       string `json:"refName"`
	RefKey        string `json:"refKey"`
	Prefix        string `json:"prefix"`
	Status        string `json:"status"`
	Sensitive     bool   `json:"sensitive"`
	Revealable    bool   `json:"revealable"`
}

func (m *KubeManager) GetPodEnvironment(namespace, podName string) (PodEnvironment, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return PodEnvironment{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pod, err := dyn.Resource(schema.GroupVersionResource{Version: "v1", Resource: "pods"}).Namespace(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return PodEnvironment{}, err
	}
	resolver := envResolver{ctx: ctx, dyn: dyn, namespace: namespace, cache: map[string]map[string]string{}, warnings: []string{}}
	entries := []PodEnvironmentEntry{}
	if spec, ok := nestedMap(pod.Object, "spec"); ok {
		entries = append(entries, resolver.entriesForContainers("container", mustSlice(spec["containers"]))...)
		entries = append(entries, resolver.entriesForContainers("initContainer", mustSlice(spec["initContainers"]))...)
		entries = append(entries, resolver.entriesForContainers("ephemeralContainer", mustSlice(spec["ephemeralContainers"]))...)
	}
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].ContainerType != entries[j].ContainerType {
			return entries[i].ContainerType < entries[j].ContainerType
		}
		if entries[i].Container != entries[j].Container {
			return entries[i].Container < entries[j].Container
		}
		return entries[i].Name < entries[j].Name
	})
	return PodEnvironment{Entries: entries, Warnings: resolver.warnings}, nil
}

func (m *KubeManager) RevealPodEnvironmentSecret(namespace, secretName, key string) (string, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	secret, err := dyn.Resource(schema.GroupVersionResource{Version: "v1", Resource: "secrets"}).Namespace(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	data, ok := nestedMap(secret.Object, "data")
	if !ok {
		return "", fmt.Errorf("secret has no data")
	}
	raw, ok := data[key].(string)
	if !ok {
		return "", fmt.Errorf("secret key not found")
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", fmt.Errorf("secret value could not be decoded")
	}
	if !isMostlyText(decoded) {
		return base64.StdEncoding.EncodeToString(decoded), nil
	}
	return string(decoded), nil
}

type envResolver struct {
	ctx       context.Context
	dyn       dynamic.Interface
	namespace string
	cache     map[string]map[string]string
	warnings  []string
}

func (r *envResolver) entriesForContainers(containerType string, containers []any) []PodEnvironmentEntry {
	entries := []PodEnvironmentEntry{}
	for _, raw := range containers {
		container, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		name, _ := container["name"].(string)
		entries = append(entries, r.envFromEntries(containerType, name, mustSlice(container["envFrom"]))...)
		entries = append(entries, r.envEntries(containerType, name, mustSlice(container["env"]))...)
	}
	return entries
}

func (r *envResolver) envFromEntries(containerType, container string, envFrom []any) []PodEnvironmentEntry {
	entries := []PodEnvironmentEntry{}
	for _, raw := range envFrom {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		prefix, _ := item["prefix"].(string)
		if ref, ok := item["configMapRef"].(map[string]any); ok {
			name, _ := ref["name"].(string)
			optional := boolValue(ref["optional"])
			data, err := r.loadData("configmaps", name)
			if err != nil {
				if !optional {
					r.warnings = append(r.warnings, fmt.Sprintf("configMap %s could not be loaded", name))
				}
				continue
			}
			for key, value := range data {
				entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: prefix + key, Value: value, Source: "envFrom configMap", RefName: name, RefKey: key, Prefix: prefix, Status: "resolved"})
			}
		}
		if ref, ok := item["secretRef"].(map[string]any); ok {
			name, _ := ref["name"].(string)
			optional := boolValue(ref["optional"])
			data, err := r.loadData("secrets", name)
			if err != nil {
				if !optional {
					r.warnings = append(r.warnings, fmt.Sprintf("secret %s could not be loaded", name))
				}
				continue
			}
			for key := range data {
				entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: prefix + key, Source: "envFrom secret", RefName: name, RefKey: key, Prefix: prefix, Status: "masked", Sensitive: true, Revealable: true})
			}
		}
	}
	return entries
}

func (r *envResolver) envEntries(containerType, container string, env []any) []PodEnvironmentEntry {
	entries := []PodEnvironmentEntry{}
	for _, raw := range env {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		name, _ := item["name"].(string)
		if value, ok := item["value"].(string); ok {
			entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Value: value, Source: "literal", Status: "resolved"})
			continue
		}
		valueFrom, _ := item["valueFrom"].(map[string]any)
		if ref, ok := valueFrom["configMapKeyRef"].(map[string]any); ok {
			refName, _ := ref["name"].(string)
			key, _ := ref["key"].(string)
			value, status := r.configMapKey(refName, key, boolValue(ref["optional"]))
			entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Value: value, Source: "configMapKeyRef", RefName: refName, RefKey: key, Status: status})
			continue
		}
		if ref, ok := valueFrom["secretKeyRef"].(map[string]any); ok {
			refName, _ := ref["name"].(string)
			key, _ := ref["key"].(string)
			status := "masked"
			if data, err := r.loadData("secrets", refName); err != nil {
				if boolValue(ref["optional"]) {
					status = "optional missing"
				} else {
					status = "unresolved"
					r.warnings = append(r.warnings, fmt.Sprintf("secret %s/%s could not be loaded", refName, key))
				}
			} else if _, ok := data[key]; !ok {
				if boolValue(ref["optional"]) {
					status = "optional missing"
				} else {
					status = "unresolved"
					r.warnings = append(r.warnings, fmt.Sprintf("secret key %s/%s is missing", refName, key))
				}
			}
			entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Source: "secretKeyRef", RefName: refName, RefKey: key, Status: status, Sensitive: true, Revealable: status == "masked"})
			continue
		}
		if ref, ok := valueFrom["fieldRef"].(map[string]any); ok {
			fieldPath, _ := ref["fieldPath"].(string)
			entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Value: fieldPath, Source: "fieldRef", RefKey: fieldPath, Status: "runtime"})
			continue
		}
		if ref, ok := valueFrom["resourceFieldRef"].(map[string]any); ok {
			resource, _ := ref["resource"].(string)
			entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Value: resource, Source: "resourceFieldRef", RefKey: resource, Status: "runtime"})
			continue
		}
		entries = append(entries, PodEnvironmentEntry{ContainerType: containerType, Container: container, Name: name, Source: "unknown", Status: "unresolved"})
	}
	return entries
}

func (r *envResolver) configMapKey(name, key string, optional bool) (string, string) {
	data, err := r.loadData("configmaps", name)
	if err != nil {
		if optional {
			return "", "optional missing"
		}
		r.warnings = append(r.warnings, fmt.Sprintf("configMap %s/%s could not be loaded", name, key))
		return "", "unresolved"
	}
	value, ok := data[key]
	if !ok {
		if optional {
			return "", "optional missing"
		}
		r.warnings = append(r.warnings, fmt.Sprintf("configMap key %s/%s is missing", name, key))
		return "", "unresolved"
	}
	return value, "resolved"
}

func (r *envResolver) loadData(resourceName, name string) (map[string]string, error) {
	cacheKey := resourceName + "/" + name
	if data, ok := r.cache[cacheKey]; ok {
		return data, nil
	}
	obj, err := r.dyn.Resource(schema.GroupVersionResource{Version: "v1", Resource: resourceName}).Namespace(r.namespace).Get(r.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	if resourceName == "configmaps" {
		data, _, _ := unstructured.NestedStringMap(obj.Object, "data")
		for k, v := range data {
			out[k] = v
		}
	} else {
		data, ok := nestedMap(obj.Object, "data")
		if ok {
			for k, v := range data {
				if encoded, ok := v.(string); ok {
					out[k] = encoded
				}
			}
		}
	}
	r.cache[cacheKey] = out
	return out, nil
}

func boolValue(raw any) bool {
	v, _ := raw.(bool)
	return v
}

func isMostlyText(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	for _, b := range data {
		if b == 0 {
			return false
		}
		if b < 0x09 || (b > 0x0d && b < 0x20) {
			return false
		}
	}
	return !strings.Contains(string(data), "\x00")
}
