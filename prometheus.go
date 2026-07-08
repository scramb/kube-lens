package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
)

const (
	PrometheusModeAuto   = "auto"
	PrometheusModeManual = "manual"
	PrometheusModeOff    = "off"

	PrometheusAccessManual = "manual"
	PrometheusAccessProxy  = "proxy"
)

type PrometheusClusterSelector struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type PrometheusTarget struct {
	AccessMode string `json:"accessMode"`
	Namespace  string `json:"namespace"`
	Service    string `json:"service"`
	PortName   string `json:"portName"`
	Port       int64  `json:"port"`
	PathPrefix string `json:"pathPrefix"`
}

type PrometheusContextSettings struct {
	Mode            string                    `json:"mode"`
	URL             string                    `json:"url"`
	Headers         map[string]string         `json:"headers"`
	ClusterSelector PrometheusClusterSelector `json:"clusterSelector"`
	Target          PrometheusTarget          `json:"target"`
}

type PrometheusTargetCandidate struct {
	Namespace string   `json:"namespace"`
	Service   string   `json:"service"`
	PortName  string   `json:"portName"`
	Port      int64    `json:"port"`
	Score     int      `json:"score"`
	Reasons   []string `json:"reasons"`
}

type PrometheusConnectionTestResult struct {
	OK             bool     `json:"ok"`
	Mode           string   `json:"mode"`
	Message        string   `json:"message"`
	SampleCount    int      `json:"sampleCount"`
	ClusterLabel   string   `json:"clusterLabel"`
	ClusterValues  []string `json:"clusterValues"`
	ProxyForbidden bool     `json:"proxyForbidden"`
}

type MetricsAvailability struct {
	Available      bool   `json:"available"`
	Mode           string `json:"mode"`
	Message        string `json:"message"`
	ProxyForbidden bool   `json:"proxyForbidden"`
}

type ResourceListMetric struct {
	Namespace string  `json:"namespace"`
	Name      string  `json:"name"`
	CPU       float64 `json:"cpu"`
	Memory    float64 `json:"memory"`
}

type MetricPoint struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

type MetricSeries struct {
	Name   string        `json:"name"`
	Unit   string        `json:"unit"`
	Points []MetricPoint `json:"points"`
}

type ResourceMetricsSeries struct {
	Available bool           `json:"available"`
	Series    []MetricSeries `json:"series"`
}

type ClusterOverviewMetrics struct {
	Available      bool    `json:"available"`
	CPUUsage       float64 `json:"cpuUsage"`
	CPUCapacity    float64 `json:"cpuCapacity"`
	MemoryUsage    float64 `json:"memoryUsage"`
	MemoryCapacity float64 `json:"memoryCapacity"`
	NodeReady      int     `json:"nodeReady"`
	NodeNotReady   int     `json:"nodeNotReady"`
	PodsRunning    int     `json:"podsRunning"`
	PodsPending    int     `json:"podsPending"`
	PodsFailed     int     `json:"podsFailed"`
	Message        string  `json:"message"`
}

type prometheusAPIResponse struct {
	Status    string          `json:"status"`
	Data      json.RawMessage `json:"data"`
	ErrorType string          `json:"errorType"`
	Error     string          `json:"error"`
}

type prometheusVectorData struct {
	ResultType string             `json:"resultType"`
	Result     []prometheusSample `json:"result"`
}

type prometheusMatrixData struct {
	ResultType string             `json:"resultType"`
	Result     []prometheusSample `json:"result"`
}

type prometheusSample struct {
	Metric map[string]string `json:"metric"`
	Value  []any             `json:"value"`
	Values [][]any           `json:"values"`
}

type prometheusCacheEntry struct {
	Expires time.Time
	Body    []byte
}

type promQueryDef struct {
	Key   string
	Name  string
	Unit  string
	Query string
}

var podListMetricQueries = []promQueryDef{
	{Key: "cpu", Name: "CPU", Unit: "cores", Query: `sum by (namespace,pod) (rate(container_cpu_usage_seconds_total{container!="",pod!=""}[5m]))`},
	{Key: "memory", Name: "Memory", Unit: "bytes", Query: `sum by (namespace,pod) (container_memory_working_set_bytes{container!="",pod!=""})`},
}

var nodeListMetricQueries = []promQueryDef{
	{Key: "cpu", Name: "CPU", Unit: "cores", Query: `sum by (node) (rate(node_cpu_seconds_total{mode!="idle"}[5m])) or sum by (instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))`},
	{Key: "memory", Name: "Memory", Unit: "bytes", Query: `sum by (node) (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) or sum by (instance) (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)`},
}

func cloneStringMap(in map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range in {
		out[k] = v
	}
	return out
}

func normalizePrometheusSettings(cfg PrometheusContextSettings) PrometheusContextSettings {
	cfg.Mode = strings.TrimSpace(cfg.Mode)
	switch cfg.Mode {
	case PrometheusModeAuto, PrometheusModeManual, PrometheusModeOff:
	default:
		cfg.Mode = PrometheusModeOff
	}
	cfg.URL = strings.TrimSpace(cfg.URL)
	cfg.ClusterSelector.Label = strings.TrimSpace(cfg.ClusterSelector.Label)
	cfg.ClusterSelector.Value = strings.TrimSpace(cfg.ClusterSelector.Value)
	cfg.Target.AccessMode = strings.TrimSpace(cfg.Target.AccessMode)
	cfg.Target.Namespace = strings.TrimSpace(cfg.Target.Namespace)
	cfg.Target.Service = strings.TrimSpace(cfg.Target.Service)
	cfg.Target.PortName = strings.TrimSpace(cfg.Target.PortName)
	cfg.Target.PathPrefix = strings.TrimRight(strings.TrimSpace(cfg.Target.PathPrefix), "/")
	if cfg.Target.AccessMode == "" && cfg.Target.Service != "" {
		cfg.Target.AccessMode = PrometheusAccessProxy
	}

	cleanHeaders := map[string]string{}
	for k, v := range cfg.Headers {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		cleanHeaders[key] = v
	}
	cfg.Headers = cleanHeaders
	return cfg
}

func (m *KubeManager) PrometheusSettings(contextName string) PrometheusContextSettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := normalizePrometheusSettings(m.settings.Prometheus[contextName])
	cfg.Headers = cloneStringMap(cfg.Headers)
	return cfg
}

func (m *KubeManager) SetPrometheusSettings(contextName string, cfg PrometheusContextSettings) PrometheusContextSettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.settings.Prometheus == nil {
		m.settings.Prometheus = map[string]PrometheusContextSettings{}
	}
	cfg = normalizePrometheusSettings(cfg)
	m.settings.Prometheus[contextName] = cfg
	m.settings.save()
	m.promCache = map[string]prometheusCacheEntry{}
	cfg.Headers = cloneStringMap(cfg.Headers)
	return cfg
}

func (m *KubeManager) DiscoverPrometheusTargets(contextName string) ([]PrometheusTargetCandidate, error) {
	_ = contextName
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	list, err := dyn.Resource(schema.GroupVersionResource{Version: "v1", Resource: "services"}).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	candidates := []PrometheusTargetCandidate{}
	for _, item := range list.Items {
		labels := item.GetLabels()
		name := item.GetName()
		ns := item.GetNamespace()
		ports, _, _ := unstructured.NestedSlice(item.Object, "spec", "ports")
		for _, rawPort := range ports {
			p, ok := rawPort.(map[string]any)
			if !ok {
				continue
			}
			port := int64(0)
			switch v := p["port"].(type) {
			case int64:
				port = v
			case int32:
				port = int64(v)
			case float64:
				port = int64(v)
			}
			portName, _ := p["name"].(string)
			score, reasons := scorePrometheusService(name, labels, portName, port)
			if score == 0 {
				continue
			}
			candidates = append(candidates, PrometheusTargetCandidate{Namespace: ns, Service: name, PortName: portName, Port: port, Score: score, Reasons: reasons})
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Score != candidates[j].Score {
			return candidates[i].Score > candidates[j].Score
		}
		if candidates[i].Namespace != candidates[j].Namespace {
			return candidates[i].Namespace < candidates[j].Namespace
		}
		return candidates[i].Service < candidates[j].Service
	})
	return candidates, nil
}

func scorePrometheusService(name string, labels map[string]string, portName string, port int64) (int, []string) {
	score := 0
	reasons := []string{}
	appName := strings.ToLower(labels["app.kubernetes.io/name"])
	switch appName {
	case "prometheus", "thanos-query", "mimir":
		score += 60
		reasons = append(reasons, "app.kubernetes.io/name="+appName)
	}
	lowerName := strings.ToLower(name)
	for _, needle := range []string{"prometheus-operated", "kube-prometheus", "prometheus", "thanos-query", "mimir"} {
		if strings.Contains(lowerName, needle) {
			score += 25
			reasons = append(reasons, "service name contains "+needle)
			break
		}
	}
	if port == 9090 {
		score += 20
		reasons = append(reasons, "port 9090")
	}
	if strings.EqualFold(portName, "web") || strings.Contains(strings.ToLower(portName), "http") {
		score += 10
		reasons = append(reasons, "web/http port")
	}
	return score, reasons
}

func (m *KubeManager) GetPrometheusLabelValues(contextName string, cfg PrometheusContextSettings, label string) ([]string, error) {
	cfg = m.effectivePrometheusSettings(contextName, cfg)
	label = strings.TrimSpace(label)
	if label == "" {
		return []string{}, nil
	}
	return m.prometheusLabelValues(contextName, cfg, label)
}

func (m *KubeManager) TestPrometheusConnection(contextName string, cfg PrometheusContextSettings) (PrometheusConnectionTestResult, error) {
	cfg = m.effectivePrometheusSettings(contextName, cfg)
	result := PrometheusConnectionTestResult{Mode: cfg.Mode, ClusterLabel: cfg.ClusterSelector.Label}

	if cfg.Mode == PrometheusModeOff || cfg.Mode == "" {
		result.Message = "Prometheus metrics are disabled for this context."
		return result, nil
	}
	if cfg.Mode == PrometheusModeManual && cfg.URL == "" {
		result.Message = "Manual mode requires a Prometheus URL."
		return result, nil
	}
	if cfg.Mode == PrometheusModeAuto && cfg.Target.Service == "" {
		result.Message = "Select a discovered Prometheus service before testing auto mode."
		return result, nil
	}

	data, err := m.prometheusQuery(contextName, cfg, "up")
	if err != nil {
		result.Message = err.Error()
		result.ProxyForbidden = apierrors.IsForbidden(err) || strings.Contains(err.Error(), "403")
		return result, nil
	}
	result.SampleCount = len(data.Result)
	result.OK = true
	result.Message = fmt.Sprintf("Connection successful. Query returned %d samples.", result.SampleCount)

	if cfg.ClusterSelector.Label != "" {
		values, err := m.prometheusLabelValues(contextName, cfg, cfg.ClusterSelector.Label)
		if err != nil {
			result.Message = fmt.Sprintf("Connection successful, but cluster label values could not be loaded: %v", err)
			return result, nil
		}
		result.ClusterValues = values
	}
	return result, nil
}

func (m *KubeManager) GetMetricsAvailability(contextName string) MetricsAvailability {
	cfg := m.PrometheusSettings(contextName)
	res, _ := m.TestPrometheusConnection(contextName, cfg)
	return MetricsAvailability{Available: res.OK, Mode: cfg.Mode, Message: res.Message, ProxyForbidden: res.ProxyForbidden}
}

func (m *KubeManager) GetPodListMetrics(contextName, namespace string, podNames []string) ([]ResourceListMetric, error) {
	cfg := m.PrometheusSettings(contextName)
	if !prometheusConfigured(cfg) {
		return []ResourceListMetric{}, nil
	}
	out := map[string]*ResourceListMetric{}
	nameSet := stringSet(podNames)
	for _, def := range podListMetricQueries {
		data, err := m.prometheusQuery(contextName, cfg, def.Query)
		if err != nil {
			return []ResourceListMetric{}, err
		}
		for _, sample := range data.Result {
			ns := sample.Metric["namespace"]
			pod := sample.Metric["pod"]
			if namespace != "" && ns != namespace {
				continue
			}
			if len(nameSet) > 0 && !nameSet[pod] {
				continue
			}
			key := ns + "/" + pod
			metric := out[key]
			if metric == nil {
				metric = &ResourceListMetric{Namespace: ns, Name: pod}
				out[key] = metric
			}
			if def.Key == "cpu" {
				metric.CPU = sampleValue(sample)
			} else if def.Key == "memory" {
				metric.Memory = sampleValue(sample)
			}
		}
	}
	return sortedResourceMetrics(out), nil
}

func (m *KubeManager) GetNodeListMetrics(contextName string, nodeNames []string) ([]ResourceListMetric, error) {
	cfg := m.PrometheusSettings(contextName)
	if !prometheusConfigured(cfg) {
		return []ResourceListMetric{}, nil
	}
	out := map[string]*ResourceListMetric{}
	nameSet := stringSet(nodeNames)
	for _, def := range nodeListMetricQueries {
		data, err := m.prometheusQuery(contextName, cfg, def.Query)
		if err != nil {
			return []ResourceListMetric{}, err
		}
		for _, sample := range data.Result {
			name := sample.Metric["node"]
			if name == "" {
				name = sample.Metric["instance"]
			}
			if len(nameSet) > 0 && !nameSet[name] {
				continue
			}
			metric := out[name]
			if metric == nil {
				metric = &ResourceListMetric{Name: name}
				out[name] = metric
			}
			if def.Key == "cpu" {
				metric.CPU = sampleValue(sample)
			} else if def.Key == "memory" {
				metric.Memory = sampleValue(sample)
			}
		}
	}
	return sortedResourceMetrics(out), nil
}

func (m *KubeManager) GetResourceMetricsSeries(contextName, kind, namespace, name, window string) (ResourceMetricsSeries, error) {
	cfg := m.PrometheusSettings(contextName)
	if !prometheusConfigured(cfg) {
		return ResourceMetricsSeries{}, nil
	}
	step := rangeStep(window)
	queries := resourceSeriesQueries(kind, namespace, name)
	result := ResourceMetricsSeries{Available: true}
	for _, def := range queries {
		data, err := m.prometheusQueryRange(contextName, cfg, def.Query, windowDuration(window), step)
		if err != nil {
			return ResourceMetricsSeries{}, err
		}
		series := MetricSeries{Name: def.Name, Unit: def.Unit}
		if len(data.Result) > 0 {
			series.Points = samplePoints(data.Result[0])
		}
		result.Series = append(result.Series, series)
	}
	return result, nil
}

func (m *KubeManager) GetClusterOverviewMetrics(contextName string) (ClusterOverviewMetrics, error) {
	cfg := m.PrometheusSettings(contextName)
	if !prometheusConfigured(cfg) {
		return ClusterOverviewMetrics{}, nil
	}
	out := ClusterOverviewMetrics{Available: true}
	queries := map[string]string{
		"cpuUsage":       `sum(rate(container_cpu_usage_seconds_total{container!="",pod!=""}[5m]))`,
		"cpuCapacity":    `sum(kube_node_status_capacity{resource="cpu",unit="core"})`,
		"memoryUsage":    `sum(container_memory_working_set_bytes{container!="",pod!=""})`,
		"memoryCapacity": `sum(kube_node_status_capacity{resource="memory",unit="byte"})`,
		"nodeReady":      `sum(kube_node_status_condition{condition="Ready",status="true"} == 1)`,
		"nodeNotReady":   `sum(kube_node_status_condition{condition="Ready",status="true"} == 0)`,
		"podsRunning":    `sum(kube_pod_status_phase{phase="Running"} == 1)`,
		"podsPending":    `sum(kube_pod_status_phase{phase="Pending"} == 1)`,
		"podsFailed":     `sum(kube_pod_status_phase{phase="Failed"} == 1)`,
	}
	for key, query := range queries {
		data, err := m.prometheusQuery(contextName, cfg, query)
		if err != nil {
			out.Message = err.Error()
			continue
		}
		value := firstSampleValue(data)
		switch key {
		case "cpuUsage":
			out.CPUUsage = value
		case "cpuCapacity":
			out.CPUCapacity = value
		case "memoryUsage":
			out.MemoryUsage = value
		case "memoryCapacity":
			out.MemoryCapacity = value
		case "nodeReady":
			out.NodeReady = int(math.Round(value))
		case "nodeNotReady":
			out.NodeNotReady = int(math.Round(value))
		case "podsRunning":
			out.PodsRunning = int(math.Round(value))
		case "podsPending":
			out.PodsPending = int(math.Round(value))
		case "podsFailed":
			out.PodsFailed = int(math.Round(value))
		}
	}
	return out, nil
}

func (m *KubeManager) effectivePrometheusSettings(contextName string, cfg PrometheusContextSettings) PrometheusContextSettings {
	cfg = normalizePrometheusSettings(cfg)
	if cfg.Mode == "" || (cfg.Mode == PrometheusModeOff && cfg.URL == "" && cfg.Target.Service == "") {
		return m.PrometheusSettings(contextName)
	}
	return cfg
}

func prometheusConfigured(cfg PrometheusContextSettings) bool {
	return cfg.Mode == PrometheusModeManual && cfg.URL != "" || cfg.Mode == PrometheusModeAuto && cfg.Target.Service != ""
}

func (m *KubeManager) prometheusQuery(contextName string, cfg PrometheusContextSettings, query string) (prometheusVectorData, error) {
	var data prometheusVectorData
	query = injectClusterMatcher(query, cfg.ClusterSelector)
	if err := m.prometheusGetJSON(contextName, cfg, "/api/v1/query", url.Values{"query": []string{query}}, &data); err != nil {
		return data, err
	}
	return data, nil
}

func (m *KubeManager) prometheusQueryRange(contextName string, cfg PrometheusContextSettings, query string, duration time.Duration, step time.Duration) (prometheusMatrixData, error) {
	var data prometheusMatrixData
	query = injectClusterMatcher(query, cfg.ClusterSelector)
	end := time.Now()
	start := end.Add(-duration)
	values := url.Values{
		"query": []string{query},
		"start": []string{strconv.FormatFloat(float64(start.Unix()), 'f', 0, 64)},
		"end":   []string{strconv.FormatFloat(float64(end.Unix()), 'f', 0, 64)},
		"step":  []string{strconv.FormatFloat(step.Seconds(), 'f', 0, 64)},
	}
	if err := m.prometheusGetJSON(contextName, cfg, "/api/v1/query_range", values, &data); err != nil {
		return data, err
	}
	return data, nil
}

func (m *KubeManager) prometheusLabelValues(contextName string, cfg PrometheusContextSettings, label string) ([]string, error) {
	label = strings.Trim(strings.TrimSpace(label), "/")
	if label == "" {
		return []string{}, nil
	}
	var values []string
	if err := m.prometheusGetJSON(contextName, cfg, "/api/v1/label/"+url.PathEscape(label)+"/values", nil, &values); err != nil {
		return nil, err
	}
	sort.Strings(values)
	return values, nil
}

func (m *KubeManager) prometheusGetJSON(contextName string, cfg PrometheusContextSettings, endpoint string, query url.Values, out any) error {
	body, err := m.prometheusRaw(contextName, cfg, endpoint, query)
	if err != nil {
		return err
	}
	var apiResp prometheusAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return fmt.Errorf("Prometheus response could not be decoded: %w", err)
	}
	if apiResp.Status != "success" {
		if apiResp.Error != "" {
			return fmt.Errorf("Prometheus query failed: %s", apiResp.Error)
		}
		return fmt.Errorf("Prometheus query failed with status %q", apiResp.Status)
	}
	if err := json.Unmarshal(apiResp.Data, out); err != nil {
		return fmt.Errorf("Prometheus data could not be decoded: %w", err)
	}
	return nil
}

func (m *KubeManager) prometheusRaw(contextName string, cfg PrometheusContextSettings, endpoint string, query url.Values) ([]byte, error) {
	cacheKey := contextName + "|" + cfg.Mode + "|" + cfg.URL + "|" + cfg.Target.Namespace + "/" + cfg.Target.Service + ":" + cfg.Target.PortName + strconv.FormatInt(cfg.Target.Port, 10) + "|" + endpoint + "?" + query.Encode()
	m.mu.Lock()
	if entry, ok := m.promCache[cacheKey]; ok && time.Now().Before(entry.Expires) {
		body := append([]byte(nil), entry.Body...)
		m.mu.Unlock()
		return body, nil
	}
	m.mu.Unlock()

	var body []byte
	var err error
	if cfg.Mode == PrometheusModeManual {
		body, err = prometheusRawManual(cfg, endpoint, query)
	} else if cfg.Mode == PrometheusModeAuto {
		body, err = m.prometheusRawProxy(cfg, endpoint, query)
	} else {
		return nil, fmt.Errorf("Prometheus metrics are disabled")
	}
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	m.promCache[cacheKey] = prometheusCacheEntry{Expires: time.Now().Add(10 * time.Second), Body: append([]byte(nil), body...)}
	m.mu.Unlock()
	return body, nil
}

func prometheusRawManual(cfg PrometheusContextSettings, endpoint string, query url.Values) ([]byte, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("Prometheus URL is required")
	}
	base, err := url.Parse(cfg.URL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("invalid Prometheus URL")
	}
	base.Path = strings.TrimRight(base.Path, "/") + endpoint
	base.RawQuery = query.Encode()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base.String(), nil)
	if err != nil {
		return nil, err
	}
	for key, value := range cfg.Headers {
		if strings.TrimSpace(key) != "" {
			req.Header.Set(key, value)
		}
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Prometheus returned HTTP %d", resp.StatusCode)
	}
	return body, nil
}

func (m *KubeManager) prometheusRawProxy(cfg PrometheusContextSettings, endpoint string, query url.Values) ([]byte, error) {
	_, _, restCfg, err := m.clients()
	if err != nil {
		return nil, err
	}
	if cfg.Target.Namespace == "" || cfg.Target.Service == "" {
		return nil, fmt.Errorf("Prometheus service target is required")
	}
	portRef := cfg.Target.PortName
	if portRef == "" && cfg.Target.Port > 0 {
		portRef = strconv.FormatInt(cfg.Target.Port, 10)
	}
	if portRef == "" {
		return nil, fmt.Errorf("Prometheus service port is required")
	}
	client, err := coreRESTClient(restCfg)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	path := strings.TrimRight(cfg.Target.PathPrefix, "/") + endpoint
	req := client.Get().Namespace(cfg.Target.Namespace).Resource("services").Name(cfg.Target.Service + ":" + portRef).SubResource("proxy").Suffix(strings.TrimLeft(path, "/"))
	// Forward configured headers (e.g. Mimir X-Scope-OrgID) through the proxy too.
	for key, value := range cfg.Headers {
		if strings.TrimSpace(key) != "" {
			req = req.SetHeader(key, value)
		}
	}
	for key, values := range query {
		for _, value := range values {
			req = req.Param(key, value)
		}
	}
	return req.Do(ctx).Raw()
}

func coreRESTClient(restCfg *rest.Config) (rest.Interface, error) {
	cfg := rest.CopyConfig(restCfg)
	gv := schema.GroupVersion{Version: "v1"}
	cfg.GroupVersion = &gv
	cfg.APIPath = "/api"
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	return rest.RESTClientFor(cfg)
}

func injectClusterMatcher(query string, selector PrometheusClusterSelector) string {
	if selector.Label == "" || selector.Value == "" {
		return query
	}
	matcher := selector.Label + `="` + strings.ReplaceAll(selector.Value, `"`, `\"`) + `"`
	var b strings.Builder
	for i := 0; i < len(query); i++ {
		if query[i] != '{' {
			b.WriteByte(query[i])
			continue
		}
		end := strings.IndexByte(query[i+1:], '}')
		if end < 0 {
			b.WriteByte(query[i])
			continue
		}
		content := query[i+1 : i+1+end]
		b.WriteByte('{')
		if strings.Contains(content, selector.Label+"=") || strings.Contains(content, selector.Label+"!=") || strings.TrimSpace(content) == "" {
			b.WriteString(content)
		} else {
			b.WriteString(matcher)
			b.WriteByte(',')
			b.WriteString(content)
		}
		b.WriteByte('}')
		i += end + 1
	}
	return b.String()
}

func stringSet(values []string) map[string]bool {
	out := map[string]bool{}
	for _, v := range values {
		if v != "" {
			out[v] = true
		}
	}
	return out
}

func sortedResourceMetrics(in map[string]*ResourceListMetric) []ResourceListMetric {
	keys := make([]string, 0, len(in))
	for key := range in {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	out := make([]ResourceListMetric, 0, len(keys))
	for _, key := range keys {
		out = append(out, *in[key])
	}
	return out
}

func sampleValue(sample prometheusSample) float64 {
	if len(sample.Value) < 2 {
		return 0
	}
	return parsePromValue(sample.Value[1])
}

func firstSampleValue(data prometheusVectorData) float64 {
	if len(data.Result) == 0 {
		return 0
	}
	return sampleValue(data.Result[0])
}

func parsePromValue(value any) float64 {
	switch v := value.(type) {
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	case float64:
		return v
	case int64:
		return float64(v)
	default:
		return 0
	}
}

func samplePoints(sample prometheusSample) []MetricPoint {
	points := make([]MetricPoint, 0, len(sample.Values))
	for _, pair := range sample.Values {
		if len(pair) < 2 {
			continue
		}
		ts := parsePromValue(pair[0])
		points = append(points, MetricPoint{Timestamp: time.Unix(int64(ts), 0).Format(time.RFC3339), Value: parsePromValue(pair[1])})
	}
	return points
}

func windowDuration(window string) time.Duration {
	switch window {
	case "6h":
		return 6 * time.Hour
	case "24h":
		return 24 * time.Hour
	default:
		return time.Hour
	}
}

func rangeStep(window string) time.Duration {
	switch window {
	case "24h":
		return 5 * time.Minute
	case "6h":
		return 2 * time.Minute
	default:
		return 30 * time.Second
	}
}

func resourceSeriesQueries(kind, namespace, name string) []promQueryDef {
	if kind == "Pod" {
		match := fmt.Sprintf(`namespace=%q,pod=%q`, namespace, name)
		return []promQueryDef{
			{Name: "CPU", Unit: "cores", Query: `sum(rate(container_cpu_usage_seconds_total{container!="",` + match + `}[5m]))`},
			{Name: "Memory", Unit: "bytes", Query: `sum(container_memory_working_set_bytes{container!="",` + match + `})`},
			{Name: "Network RX", Unit: "bytes/s", Query: `sum(rate(container_network_receive_bytes_total{` + match + `}[5m]))`},
			{Name: "Network TX", Unit: "bytes/s", Query: `sum(rate(container_network_transmit_bytes_total{` + match + `}[5m]))`},
		}
	}
	if kind == "Node" {
		return []promQueryDef{
			{Name: "CPU", Unit: "cores", Query: `sum(rate(node_cpu_seconds_total{mode!="idle",node=` + strconv.Quote(name) + `}[5m])) or sum(rate(node_cpu_seconds_total{mode!="idle",instance=` + strconv.Quote(name) + `}[5m]))`},
			{Name: "Memory", Unit: "bytes", Query: `sum(node_memory_MemTotal_bytes{node=` + strconv.Quote(name) + `} - node_memory_MemAvailable_bytes{node=` + strconv.Quote(name) + `}) or sum(node_memory_MemTotal_bytes{instance=` + strconv.Quote(name) + `} - node_memory_MemAvailable_bytes{instance=` + strconv.Quote(name) + `})`},
		}
	}
	return nil
}

// ---------- App wrappers ----------

func (a *App) GetPrometheusSettings(contextName string) PrometheusContextSettings {
	return a.kube.PrometheusSettings(contextName)
}

func (a *App) SetPrometheusSettings(contextName string, cfg PrometheusContextSettings) PrometheusContextSettings {
	return a.kube.SetPrometheusSettings(contextName, cfg)
}

func (a *App) DiscoverPrometheusTargets(contextName string) ([]PrometheusTargetCandidate, error) {
	return a.kube.DiscoverPrometheusTargets(contextName)
}

func (a *App) GetPrometheusLabelValues(contextName string, cfg PrometheusContextSettings, label string) ([]string, error) {
	return a.kube.GetPrometheusLabelValues(contextName, cfg, label)
}

func (a *App) TestPrometheusConnection(contextName string, cfg PrometheusContextSettings) (PrometheusConnectionTestResult, error) {
	return a.kube.TestPrometheusConnection(contextName, cfg)
}

func (a *App) GetMetricsAvailability(contextName string) MetricsAvailability {
	return a.kube.GetMetricsAvailability(contextName)
}

func (a *App) GetPodListMetrics(contextName, namespace string, podNames []string) ([]ResourceListMetric, error) {
	return a.kube.GetPodListMetrics(contextName, namespace, podNames)
}

func (a *App) GetNodeListMetrics(contextName string, nodeNames []string) ([]ResourceListMetric, error) {
	return a.kube.GetNodeListMetrics(contextName, nodeNames)
}

func (a *App) GetResourceMetricsSeries(contextName, kind, namespace, name, window string) (ResourceMetricsSeries, error) {
	return a.kube.GetResourceMetricsSeries(contextName, kind, namespace, name, window)
}

func (a *App) GetClusterOverviewMetrics(contextName string) (ClusterOverviewMetrics, error) {
	return a.kube.GetClusterOverviewMetrics(contextName)
}
