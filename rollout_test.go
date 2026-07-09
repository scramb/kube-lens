package main

import (
	"encoding/json"
	"testing"
)

func TestRolloutRestartPatch(t *testing.T) {
	patch, err := rolloutRestartPatch("2026-07-09T10:00:00Z")
	if err != nil {
		t.Fatalf("rolloutRestartPatch returned error: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(patch), &decoded); err != nil {
		t.Fatalf("patch is not valid JSON: %v", err)
	}
	annotations := decoded["spec"].(map[string]any)["template"].(map[string]any)["metadata"].(map[string]any)["annotations"].(map[string]any)
	if got := annotations[rolloutRestartAnnotation]; got != "2026-07-09T10:00:00Z" {
		t.Fatalf("restart annotation = %v", got)
	}
}

func TestScalePatch(t *testing.T) {
	patch, err := scalePatch(0)
	if err != nil {
		t.Fatalf("scalePatch returned error: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(patch), &decoded); err != nil {
		t.Fatalf("patch is not valid JSON: %v", err)
	}
	if got := decoded["spec"].(map[string]any)["replicas"]; got != float64(0) {
		t.Fatalf("replicas = %v", got)
	}
}

func TestValidateRolloutRestartTarget(t *testing.T) {
	for _, resource := range []string{"deployments", "statefulsets", "daemonsets"} {
		if err := validateRolloutRestartTarget("apps", "v1", resource); err != nil {
			t.Fatalf("expected %s to be supported: %v", resource, err)
		}
	}
	for _, resource := range []string{"replicasets", "pods"} {
		if err := validateRolloutRestartTarget("apps", "v1", resource); err == nil {
			t.Fatalf("expected %s to be rejected", resource)
		}
	}
	if err := validateRolloutRestartTarget("", "v1", "pods"); err == nil {
		t.Fatal("expected non-apps group to be rejected")
	}
}

func TestValidateScaleTarget(t *testing.T) {
	for _, resource := range []string{"deployments", "statefulsets"} {
		if err := validateScaleTarget("apps", "v1", resource, 0); err != nil {
			t.Fatalf("expected %s to be supported: %v", resource, err)
		}
	}
	for _, resource := range []string{"daemonsets", "replicasets", "pods"} {
		if err := validateScaleTarget("apps", "v1", resource, 1); err == nil {
			t.Fatalf("expected %s to be rejected", resource)
		}
	}
	if err := validateScaleTarget("apps", "v1", "deployments", -1); err == nil {
		t.Fatal("expected negative replicas to be rejected")
	}
}
