package main

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	kscheme "k8s.io/client-go/kubernetes/scheme"
)

func testConfigMap(name string, data map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1",
		"kind":       "ConfigMap",
		"metadata":   map[string]any{"name": name, "namespace": "ns"},
		"data":       data,
	}}
}

func testSecret(name string, data map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1",
		"kind":       "Secret",
		"metadata":   map[string]any{"name": name, "namespace": "ns"},
		"data":       data,
	}}
}

func TestEnvEntriesLiteralAndRefs(t *testing.T) {
	cm := testConfigMap("app-config", map[string]any{"LOG_LEVEL": "debug"})
	secret := testSecret("app-secret", map[string]any{"TOKEN": base64.StdEncoding.EncodeToString([]byte("s3cret"))})
	dyn := dynamicfake.NewSimpleDynamicClient(kscheme.Scheme, cm, secret)
	r := &envResolver{ctx: context.Background(), dyn: dyn, namespace: "ns", cache: map[string]map[string]string{}, warnings: []string{}}

	env := []any{
		map[string]any{"name": "PLAIN", "value": "hello"},
		map[string]any{"name": "FROM_CM", "valueFrom": map[string]any{"configMapKeyRef": map[string]any{"name": "app-config", "key": "LOG_LEVEL"}}},
		map[string]any{"name": "FROM_SECRET", "valueFrom": map[string]any{"secretKeyRef": map[string]any{"name": "app-secret", "key": "TOKEN"}}},
		map[string]any{"name": "MISSING_OPTIONAL", "valueFrom": map[string]any{"configMapKeyRef": map[string]any{"name": "app-config", "key": "NOPE", "optional": true}}},
		map[string]any{"name": "MISSING_REQUIRED", "valueFrom": map[string]any{"secretKeyRef": map[string]any{"name": "app-secret", "key": "NOPE"}}},
		map[string]any{"name": "POD_NAME", "valueFrom": map[string]any{"fieldRef": map[string]any{"fieldPath": "metadata.name"}}},
		map[string]any{"name": "CPU", "valueFrom": map[string]any{"resourceFieldRef": map[string]any{"resource": "limits.cpu"}}},
	}

	entries := r.envEntries("container", "main", env)
	byName := map[string]PodEnvironmentEntry{}
	for _, e := range entries {
		byName[e.Name] = e
	}

	if e := byName["PLAIN"]; e.Value != "hello" || e.Source != "literal" || e.Status != "resolved" {
		t.Errorf("PLAIN = %+v", e)
	}
	if e := byName["FROM_CM"]; e.Value != "debug" || e.Source != "configMapKeyRef" || e.Status != "resolved" {
		t.Errorf("FROM_CM = %+v", e)
	}
	if e := byName["FROM_SECRET"]; e.Status != "masked" || !e.Sensitive || !e.Revealable || e.Value != "" {
		t.Errorf("FROM_SECRET must be masked/sensitive/revealable without value, got %+v", e)
	}
	if e := byName["MISSING_OPTIONAL"]; e.Status != "optional missing" {
		t.Errorf("MISSING_OPTIONAL = %+v", e)
	}
	if e := byName["MISSING_REQUIRED"]; e.Status != "unresolved" || e.Revealable {
		t.Errorf("MISSING_REQUIRED = %+v", e)
	}
	if e := byName["POD_NAME"]; e.Source != "fieldRef" || e.Status != "runtime" || e.Value != "metadata.name" {
		t.Errorf("POD_NAME = %+v", e)
	}
	if e := byName["CPU"]; e.Source != "resourceFieldRef" || e.Status != "runtime" {
		t.Errorf("CPU = %+v", e)
	}

	foundWarning := false
	for _, w := range r.warnings {
		if strings.Contains(w, "app-secret/NOPE") {
			foundWarning = true
		}
	}
	if !foundWarning {
		t.Errorf("expected warning for missing required secret key, got %v", r.warnings)
	}
}

func TestEnvFromExpansionWithPrefix(t *testing.T) {
	cm := testConfigMap("bulk", map[string]any{"A": "1", "B": "2"})
	secret := testSecret("creds", map[string]any{"USER": base64.StdEncoding.EncodeToString([]byte("u"))})
	dyn := dynamicfake.NewSimpleDynamicClient(kscheme.Scheme, cm, secret)
	r := &envResolver{ctx: context.Background(), dyn: dyn, namespace: "ns", cache: map[string]map[string]string{}, warnings: []string{}}

	envFrom := []any{
		map[string]any{"prefix": "CFG_", "configMapRef": map[string]any{"name": "bulk"}},
		map[string]any{"secretRef": map[string]any{"name": "creds"}},
		map[string]any{"configMapRef": map[string]any{"name": "does-not-exist", "optional": true}},
		map[string]any{"secretRef": map[string]any{"name": "also-missing"}},
	}

	entries := r.envFromEntries("container", "main", envFrom)
	byName := map[string]PodEnvironmentEntry{}
	for _, e := range entries {
		byName[e.Name] = e
	}

	if e := byName["CFG_A"]; e.Value != "1" || e.Prefix != "CFG_" || e.Source != "envFrom configMap" {
		t.Errorf("CFG_A = %+v", e)
	}
	if _, ok := byName["A"]; ok {
		t.Error("unprefixed key A must not exist when prefix is set")
	}
	if e := byName["USER"]; !e.Sensitive || !e.Revealable || e.Status != "masked" || e.Value != "" {
		t.Errorf("USER = %+v", e)
	}

	// Optional missing source: no warning. Required missing source: warning.
	for _, w := range r.warnings {
		if strings.Contains(w, "does-not-exist") {
			t.Errorf("optional missing configMap must not warn, got %v", r.warnings)
		}
	}
	foundWarning := false
	for _, w := range r.warnings {
		if strings.Contains(w, "also-missing") {
			foundWarning = true
		}
	}
	if !foundWarning {
		t.Errorf("required missing secret must warn, got %v", r.warnings)
	}
}

func TestIsMostlyText(t *testing.T) {
	if !isMostlyText([]byte("hello world\nüäö")) {
		t.Error("plain text should be text")
	}
	if !isMostlyText(nil) {
		t.Error("empty should count as text")
	}
	if isMostlyText([]byte{0x00, 0x01, 0x02}) {
		t.Error("null bytes should not be text")
	}
	if isMostlyText([]byte{'a', 0x07, 'b'}) {
		t.Error("control characters should not be text")
	}
}
