package main

import (
	"math"
	"testing"
)

func container(name string, requests, limits map[string]any) map[string]any {
	resources := map[string]any{}
	if requests != nil {
		resources["requests"] = requests
	}
	if limits != nil {
		resources["limits"] = limits
	}
	return map[string]any{"name": name, "resources": resources}
}

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestQuantitySummaryForPodSpecSumsAppContainers(t *testing.T) {
	spec := map[string]any{
		"containers": []any{
			container("a", map[string]any{"cpu": "100m", "memory": "128Mi"}, map[string]any{"cpu": "200m"}),
			container("b", map[string]any{"cpu": "0.2", "memory": "128Mi"}, nil),
		},
	}

	got := quantitySummaryForPodSpec(spec)

	if !got.HasCPURequest || !almostEqual(got.CPURequest, 0.3) {
		t.Errorf("cpu request = %v (has=%v), want 0.3", got.CPURequest, got.HasCPURequest)
	}
	if !got.HasMemRequest || !almostEqual(got.MemoryRequest, 2*128*1024*1024) {
		t.Errorf("memory request = %v (has=%v), want 256Mi", got.MemoryRequest, got.HasMemRequest)
	}
	if !got.HasCPULimit || !almostEqual(got.CPULimit, 0.2) {
		t.Errorf("cpu limit = %v (has=%v), want 0.2", got.CPULimit, got.HasCPULimit)
	}
	if got.HasMemLimit {
		t.Errorf("memory limit should be absent, got %v", got.MemoryLimit)
	}
}

func TestQuantitySummaryForPodSpecInitContainerDominates(t *testing.T) {
	// Effective pod value = max(sum(app containers), max(init containers)).
	spec := map[string]any{
		"containers": []any{
			container("app", map[string]any{"cpu": "100m"}, nil),
		},
		"initContainers": []any{
			container("init-small", map[string]any{"cpu": "50m"}, nil),
			container("init-big", map[string]any{"cpu": "1"}, nil),
		},
	}

	got := quantitySummaryForPodSpec(spec)

	if !almostEqual(got.CPURequest, 1) {
		t.Errorf("cpu request = %v, want 1 (init container dominates)", got.CPURequest)
	}
}

func TestQuantitySummaryForPodSpecAppSumDominatesInit(t *testing.T) {
	spec := map[string]any{
		"containers": []any{
			container("a", map[string]any{"memory": "512Mi"}, nil),
			container("b", map[string]any{"memory": "512Mi"}, nil),
		},
		"initContainers": []any{
			container("init", map[string]any{"memory": "600Mi"}, nil),
		},
	}

	got := quantitySummaryForPodSpec(spec)

	if !almostEqual(got.MemoryRequest, 1024*1024*1024) {
		t.Errorf("memory request = %v, want 1Gi (app sum dominates)", got.MemoryRequest)
	}
}

func TestQuantitySummaryIgnoresInvalidAndMissingValues(t *testing.T) {
	spec := map[string]any{
		"containers": []any{
			container("a", map[string]any{"cpu": "not-a-quantity"}, nil),
			container("b", nil, nil),
		},
	}

	got := quantitySummaryForPodSpec(spec)

	if got.HasCPURequest || got.HasCPULimit || got.HasMemRequest || got.HasMemLimit {
		t.Errorf("expected no values, got %+v", got)
	}
}

func TestQuantitySummaryForObject(t *testing.T) {
	podSpec := map[string]any{
		"containers": []any{container("a", map[string]any{"cpu": "250m"}, nil)},
	}

	pod := map[string]any{"spec": podSpec}
	if got, ok := quantitySummaryForObject("pods", pod); !ok || !almostEqual(got.CPURequest, 0.25) {
		t.Errorf("pods: got %+v ok=%v, want cpu 0.25", got, ok)
	}

	deploy := map[string]any{"spec": map[string]any{"template": map[string]any{"spec": podSpec}}}
	if got, ok := quantitySummaryForObject("deployments", deploy); !ok || !almostEqual(got.CPURequest, 0.25) {
		t.Errorf("deployments: got %+v ok=%v, want cpu 0.25", got, ok)
	}

	if _, ok := quantitySummaryForObject("services", map[string]any{"spec": map[string]any{}}); ok {
		t.Error("services should not produce a summary")
	}

	if _, ok := quantitySummaryForObject("deployments", map[string]any{"spec": map[string]any{}}); ok {
		t.Error("deployment without pod template should not produce a summary")
	}
}

func TestQuantityParsing(t *testing.T) {
	if v, ok := cpuQuantity("100m"); !ok || !almostEqual(v, 0.1) {
		t.Errorf("cpuQuantity(100m) = %v ok=%v, want 0.1", v, ok)
	}
	if v, ok := cpuQuantity("2"); !ok || !almostEqual(v, 2) {
		t.Errorf("cpuQuantity(2) = %v ok=%v, want 2", v, ok)
	}
	if _, ok := cpuQuantity(""); ok {
		t.Error("cpuQuantity(\"\") should not parse")
	}
	if _, ok := cpuQuantity(nil); ok {
		t.Error("cpuQuantity(nil) should not parse")
	}
	if v, ok := memoryQuantity("1Gi"); !ok || !almostEqual(v, 1024*1024*1024) {
		t.Errorf("memoryQuantity(1Gi) = %v ok=%v, want 1Gi in bytes", v, ok)
	}
	if v, ok := memoryQuantity("500M"); !ok || !almostEqual(v, 500_000_000) {
		t.Errorf("memoryQuantity(500M) = %v ok=%v, want 500e6", v, ok)
	}
	if _, ok := memoryQuantity("garbage"); ok {
		t.Error("memoryQuantity(garbage) should not parse")
	}
}
