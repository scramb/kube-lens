package main

import "testing"

func fluxObj(suspend any, conditions []any, status map[string]any) map[string]any {
	obj := map[string]any{"spec": map[string]any{}, "status": map[string]any{}}
	if suspend != nil {
		obj["spec"].(map[string]any)["suspend"] = suspend
	}
	if status != nil {
		obj["status"] = status
	}
	if conditions != nil {
		obj["status"].(map[string]any)["conditions"] = conditions
	}
	return obj
}

func TestIsSuspended(t *testing.T) {
	if !isSuspended(fluxObj(true, nil, nil)) {
		t.Error("suspend=true should be suspended")
	}
	if isSuspended(fluxObj(false, nil, nil)) {
		t.Error("suspend=false should not be suspended")
	}
	if isSuspended(fluxObj(nil, nil, nil)) {
		t.Error("missing suspend should not be suspended")
	}
	if isSuspended(fluxObj("true", nil, nil)) {
		t.Error("non-bool suspend should not be suspended")
	}
}

func TestReadyCondition(t *testing.T) {
	conds := []any{
		map[string]any{"type": "Reconciling", "status": "True"},
		map[string]any{"type": "Ready", "status": "False", "reason": "BuildFailed", "message": "kustomize build failed"},
	}
	status, reason, message, found := readyCondition(fluxObj(nil, conds, nil))
	if !found || status != "False" || reason != "BuildFailed" || message != "kustomize build failed" {
		t.Errorf("got status=%q reason=%q message=%q found=%v", status, reason, message, found)
	}

	if _, _, _, found := readyCondition(fluxObj(nil, nil, nil)); found {
		t.Error("object without conditions should not have a ready condition")
	}

	onlyOther := []any{map[string]any{"type": "Healthy", "status": "True"}}
	if _, _, _, found := readyCondition(fluxObj(nil, onlyOther, nil)); found {
		t.Error("object without Ready condition type should not be found")
	}
}

func TestIsReady(t *testing.T) {
	ready := []any{map[string]any{"type": "Ready", "status": "True"}}
	if !isReady(fluxObj(nil, ready, nil)) {
		t.Error("Ready=True should be ready")
	}
	notReady := []any{map[string]any{"type": "Ready", "status": "False"}}
	if isReady(fluxObj(nil, notReady, nil)) {
		t.Error("Ready=False should not be ready")
	}
	if isReady(fluxObj(nil, nil, nil)) {
		t.Error("missing conditions should not be ready")
	}
}

func TestFluxRevisionPriority(t *testing.T) {
	obj := fluxObj(nil, nil, map[string]any{
		"lastAppliedRevision":   "main@sha1:aaa",
		"lastAttemptedRevision": "main@sha1:bbb",
	})
	if got := fluxRevision(obj); got != "main@sha1:aaa" {
		t.Errorf("got %q, want lastAppliedRevision to win", got)
	}

	obj = fluxObj(nil, nil, map[string]any{
		"lastAttemptedRevision": "main@sha1:bbb",
	})
	if got := fluxRevision(obj); got != "main@sha1:bbb" {
		t.Errorf("got %q, want lastAttemptedRevision fallback", got)
	}

	obj = fluxObj(nil, nil, map[string]any{
		"artifact": map[string]any{"revision": "main@sha1:ccc"},
	})
	if got := fluxRevision(obj); got != "main@sha1:ccc" {
		t.Errorf("got %q, want artifact revision fallback", got)
	}

	if got := fluxRevision(fluxObj(nil, nil, nil)); got != "" {
		t.Errorf("got %q, want empty for missing revision", got)
	}
}
