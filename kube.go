package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/yaml"
)

// ---------- Types exposed to the frontend ----------

type KubeConfigInfo struct {
	Path      string `json:"path"`
	IsDefault bool   `json:"isDefault"`
	Exists    bool   `json:"exists"`
	Error     string `json:"error"`
}

type ContextInfo struct {
	Name      string `json:"name"`
	Cluster   string `json:"cluster"`
	User      string `json:"user"`
	Namespace string `json:"namespace"`
	Source    string `json:"source"`
	Active    bool   `json:"active"`
}

type APIResource struct {
	Group      string `json:"group"`
	Version    string `json:"version"`
	Kind       string `json:"kind"`
	Name       string `json:"name"` // plural, e.g. "pods"
	Namespaced bool   `json:"namespaced"`
}

type TableColumn struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Priority int32  `json:"priority"`
}

type TableRow struct {
	Cells     []any  `json:"cells"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type TableResult struct {
	Columns []TableColumn `json:"columns"`
	Rows    []TableRow    `json:"rows"`
}

// ---------- Settings persistence ----------

type Settings struct {
	KubeConfigs       []string                             `json:"kubeconfigs"`
	LastContext       string                               `json:"lastContext"`
	Favorites         map[string][]string                  `json:"favorites,omitempty"`
	CollapsedSections map[string]map[string]bool           `json:"collapsedSections,omitempty"`
	HideEmptyCRDs     bool                                 `json:"hideEmptyCRDs,omitempty"`
	Prometheus        map[string]PrometheusContextSettings `json:"prometheus,omitempty"`
	CRDGrouping       CRDGroupingSettings                  `json:"crdGrouping,omitempty"`
}

type ResourceUISettings struct {
	Favorites         []string            `json:"favorites"`
	CollapsedSections map[string]bool     `json:"collapsedSections"`
	HideEmptyCRDs     bool                `json:"hideEmptyCRDs"`
	CRDGrouping       CRDGroupingSettings `json:"crdGrouping"`
}

type CRDGroupRule struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Patterns []string `json:"patterns"`
	Icon     string   `json:"icon"`
	Enabled  bool     `json:"enabled"`
}

type CRDGroupingSettings struct {
	Rules []CRDGroupRule `json:"rules"`
}

func settingsPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "kube-lens", "settings.json")
}

func loadSettings() Settings {
	var s Settings
	data, err := os.ReadFile(settingsPath())
	if err == nil {
		_ = json.Unmarshal(data, &s)
	}
	return s
}

func (s Settings) save() {
	path := settingsPath()
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	data, _ := json.MarshalIndent(s, "", "  ")
	_ = os.WriteFile(path, data, 0o600)
}

func cloneStringSlice(in []string) []string {
	if len(in) == 0 {
		return []string{}
	}
	out := make([]string, len(in))
	copy(out, in)
	return out
}

func cloneBoolMap(in map[string]bool) map[string]bool {
	out := map[string]bool{}
	for k, v := range in {
		out[k] = v
	}
	return out
}

func cloneCRDGroupingSettings(in CRDGroupingSettings) CRDGroupingSettings {
	out := CRDGroupingSettings{Rules: []CRDGroupRule{}}
	for _, rule := range in.Rules {
		out.Rules = append(out.Rules, CRDGroupRule{
			ID:       rule.ID,
			Label:    rule.Label,
			Patterns: cloneStringSlice(rule.Patterns),
			Icon:     rule.Icon,
			Enabled:  rule.Enabled,
		})
	}
	return out
}

func resourceUISettingsFromSettings(s Settings, contextName string) ResourceUISettings {
	return ResourceUISettings{
		Favorites:         cloneStringSlice(s.Favorites[contextName]),
		CollapsedSections: cloneBoolMap(s.CollapsedSections[contextName]),
		HideEmptyCRDs:     s.HideEmptyCRDs,
		CRDGrouping:       cloneCRDGroupingSettings(s.CRDGrouping),
	}
}

// ---------- Manager ----------

type KubeManager struct {
	mu             sync.Mutex
	settings       Settings
	currentContext string
	restConfig     *rest.Config
	discovery      discovery.DiscoveryInterface
	dynamic        dynamic.Interface
	promCache      map[string]prometheusCacheEntry
}

func NewKubeManager() *KubeManager {
	return &KubeManager{settings: loadSettings(), promCache: map[string]prometheusCacheEntry{}}
}

func defaultKubeConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".kube", "config")
}

// configPaths returns the default kubeconfig followed by all user-added ones.
func (m *KubeManager) configPaths() []string {
	paths := []string{}
	if def := defaultKubeConfigPath(); def != "" {
		paths = append(paths, def)
	}
	for _, p := range m.settings.KubeConfigs {
		if p != defaultKubeConfigPath() {
			paths = append(paths, p)
		}
	}
	return paths
}

func (m *KubeManager) loadingRules() *clientcmd.ClientConfigLoadingRules {
	return &clientcmd.ClientConfigLoadingRules{Precedence: m.configPaths()}
}

func (m *KubeManager) ListKubeConfigs() []KubeConfigInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	def := defaultKubeConfigPath()
	infos := []KubeConfigInfo{}
	for _, p := range m.configPaths() {
		info := KubeConfigInfo{Path: p, IsDefault: p == def}
		if _, err := os.Stat(p); err != nil {
			info.Exists = false
			if !info.IsDefault {
				info.Error = "file not found"
			}
		} else {
			info.Exists = true
			if _, err := clientcmd.LoadFromFile(p); err != nil {
				info.Error = err.Error()
			}
		}
		infos = append(infos, info)
	}
	return infos
}

func (m *KubeManager) AddKubeConfig(path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, err := clientcmd.LoadFromFile(path); err != nil {
		return fmt.Errorf("invalid kubeconfig: %w", err)
	}
	for _, p := range m.settings.KubeConfigs {
		if p == path {
			return nil
		}
	}
	m.settings.KubeConfigs = append(m.settings.KubeConfigs, path)
	m.settings.save()
	return nil
}

func (m *KubeManager) RemoveKubeConfig(path string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	kept := m.settings.KubeConfigs[:0]
	for _, p := range m.settings.KubeConfigs {
		if p != path {
			kept = append(kept, p)
		}
	}
	m.settings.KubeConfigs = kept
	m.settings.save()
}

// ListContexts merges contexts from all configured kubeconfig files.
func (m *KubeManager) ListContexts() ([]ContextInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seen := map[string]bool{}
	var contexts []ContextInfo
	for _, path := range m.configPaths() {
		cfg, err := clientcmd.LoadFromFile(path)
		if err != nil {
			continue
		}
		names := make([]string, 0, len(cfg.Contexts))
		for name := range cfg.Contexts {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			if seen[name] {
				continue
			}
			seen[name] = true
			c := cfg.Contexts[name]
			contexts = append(contexts, ContextInfo{
				Name:      name,
				Cluster:   c.Cluster,
				User:      c.AuthInfo,
				Namespace: c.Namespace,
				Source:    path,
				Active:    name == m.currentContext,
			})
		}
	}
	return contexts, nil
}

// UseContext connects to the cluster behind the given context.
func (m *KubeManager) UseContext(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cc := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		m.loadingRules(),
		&clientcmd.ConfigOverrides{CurrentContext: name},
	)
	restCfg, err := cc.ClientConfig()
	if err != nil {
		return fmt.Errorf("could not load context %q: %w", name, err)
	}
	restCfg.QPS = 50
	restCfg.Burst = 100
	restCfg.Timeout = 30 * time.Second

	disc, err := discovery.NewDiscoveryClientForConfig(restCfg)
	if err != nil {
		return err
	}
	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return err
	}

	m.restConfig = restCfg
	m.discovery = disc
	m.dynamic = dyn
	m.currentContext = name
	m.settings.LastContext = name
	m.settings.save()
	return nil
}

func (m *KubeManager) CurrentContext() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.currentContext
}

func (m *KubeManager) ResourceUISettings(contextName string) ResourceUISettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	return resourceUISettingsFromSettings(m.settings, contextName)
}

func (m *KubeManager) SetResourceFavorite(contextName, resourceKey string, favorite bool) ResourceUISettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.settings.Favorites == nil {
		m.settings.Favorites = map[string][]string{}
	}
	current := m.settings.Favorites[contextName]
	filtered := current[:0]
	for _, key := range current {
		if key != resourceKey {
			filtered = append(filtered, key)
		}
	}
	if favorite {
		filtered = append(filtered, resourceKey)
	}
	m.settings.Favorites[contextName] = cloneStringSlice(filtered)
	m.settings.save()
	return resourceUISettingsFromSettings(m.settings, contextName)
}

func (m *KubeManager) SetSectionCollapsed(contextName, sectionKey string, collapsed bool) ResourceUISettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.settings.CollapsedSections == nil {
		m.settings.CollapsedSections = map[string]map[string]bool{}
	}
	if m.settings.CollapsedSections[contextName] == nil {
		m.settings.CollapsedSections[contextName] = map[string]bool{}
	}
	m.settings.CollapsedSections[contextName][sectionKey] = collapsed
	m.settings.save()
	return resourceUISettingsFromSettings(m.settings, contextName)
}

func (m *KubeManager) SetHideEmptyCRDs(hide bool) ResourceUISettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.settings.HideEmptyCRDs = hide
	contextName := m.currentContext
	m.settings.save()
	return resourceUISettingsFromSettings(m.settings, contextName)
}

func (m *KubeManager) SetCRDGroupingSettings(settings CRDGroupingSettings) ResourceUISettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.settings.CRDGrouping = cloneCRDGroupingSettings(settings)
	contextName := m.currentContext
	m.settings.save()
	return resourceUISettingsFromSettings(m.settings, contextName)
}

// InitialContext returns the context to auto-connect on startup:
// the last used one if it still exists, otherwise the kubeconfig's current-context.
func (m *KubeManager) InitialContext() string {
	contexts, _ := m.ListContexts()
	m.mu.Lock()
	last := m.settings.LastContext
	m.mu.Unlock()
	for _, c := range contexts {
		if c.Name == last {
			return last
		}
	}
	if cfg, err := m.loadingRules().Load(); err == nil && cfg.CurrentContext != "" {
		return cfg.CurrentContext
	}
	if len(contexts) > 0 {
		return contexts[0].Name
	}
	return ""
}

func (m *KubeManager) clients() (discovery.DiscoveryInterface, dynamic.Interface, *rest.Config, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.restConfig == nil {
		return nil, nil, nil, fmt.Errorf("no cluster connected")
	}
	return m.discovery, m.dynamic, m.restConfig, nil
}

// DiscoverResources lists every listable API resource in the cluster,
// including CRDs. Subresources are skipped.
func (m *KubeManager) DiscoverResources() ([]APIResource, error) {
	disc, _, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	lists, derr := disc.ServerPreferredResources()
	if derr != nil && len(lists) == 0 {
		return nil, derr
	}
	var out []APIResource
	for _, list := range lists {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}
		for _, r := range list.APIResources {
			if strings.Contains(r.Name, "/") {
				continue
			}
			listable := false
			for _, v := range r.Verbs {
				if v == "list" {
					listable = true
					break
				}
			}
			if !listable {
				continue
			}
			out = append(out, APIResource{
				Group:      gv.Group,
				Version:    gv.Version,
				Kind:       r.Kind,
				Name:       r.Name,
				Namespaced: r.Namespaced,
			})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Group != out[j].Group {
			return out[i].Group < out[j].Group
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (m *KubeManager) ListNamespaces() ([]string, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Version: "v1", Resource: "namespaces"}
	list, err := dyn.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		names = append(names, item.GetName())
	}
	sort.Strings(names)
	return names, nil
}

func (m *KubeManager) ResourceHasItems(group, version, resource, namespace string) (bool, error) {
	_, dyn, _, err := m.clients()
	if err != nil {
		return false, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	opts := metav1.ListOptions{Limit: 1}
	var list *unstructured.UnstructuredList
	if namespace != "" {
		list, err = dyn.Resource(gvr).Namespace(namespace).List(ctx, opts)
	} else {
		list, err = dyn.Resource(gvr).List(ctx, opts)
	}
	if err != nil {
		return false, err
	}
	return len(list.Items) > 0, nil
}

// ListResourceTable fetches resources in the server-side Table format —
// the same rendering kubectl uses, so columns match `kubectl get` for
// every resource including CRDs with additionalPrinterColumns.
func (m *KubeManager) ListResourceTable(group, version, resource, namespace string) (*TableResult, error) {
	_, _, restCfg, err := m.clients()
	if err != nil {
		return nil, err
	}
	cfg := rest.CopyConfig(restCfg)
	gv := schema.GroupVersion{Group: group, Version: version}
	cfg.GroupVersion = &gv
	if group == "" {
		cfg.APIPath = "/api"
	} else {
		cfg.APIPath = "/apis"
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	client, err := rest.RESTClientFor(cfg)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req := client.Get().Resource(resource).
		SetHeader("Accept", "application/json;as=Table;v=v1;g=meta.k8s.io,application/json").
		Param("includeObject", "Metadata")
	if namespace != "" {
		req = req.Namespace(namespace)
	}
	raw, err := req.Do(ctx).Raw()
	if err != nil {
		return nil, err
	}

	var table metav1.Table
	if err := json.Unmarshal(raw, &table); err == nil && table.Kind == "Table" {
		return tableToResult(&table), nil
	}

	// Fallback for API servers that don't support Table rendering.
	var list unstructured.UnstructuredList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("could not read response: %w", err)
	}
	result := &TableResult{
		Columns: []TableColumn{{Name: "Name", Type: "string"}, {Name: "Age", Type: "string"}},
	}
	for _, item := range list.Items {
		result.Rows = append(result.Rows, TableRow{
			Cells:     []any{item.GetName(), humanAge(item.GetCreationTimestamp().Time)},
			Name:      item.GetName(),
			Namespace: item.GetNamespace(),
		})
	}
	return result, nil
}

func tableToResult(table *metav1.Table) *TableResult {
	result := &TableResult{}
	for _, col := range table.ColumnDefinitions {
		result.Columns = append(result.Columns, TableColumn{
			Name:     col.Name,
			Type:     col.Type,
			Priority: col.Priority,
		})
	}
	for _, row := range table.Rows {
		tr := TableRow{Cells: row.Cells}
		var pom metav1.PartialObjectMetadata
		if len(row.Object.Raw) > 0 {
			if err := json.Unmarshal(row.Object.Raw, &pom); err == nil {
				tr.Name = pom.Name
				tr.Namespace = pom.Namespace
			}
		}
		result.Rows = append(result.Rows, tr)
	}
	return result
}

func humanAge(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}

// GetResourceYAML returns the full manifest as YAML (managedFields stripped).
func (m *KubeManager) GetResourceYAML(group, version, resource, namespace, name string) (string, error) {
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
	data, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (m *KubeManager) DeleteResource(group, version, resource, namespace, name string) error {
	_, dyn, _, err := m.clients()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	if namespace != "" {
		return dyn.Resource(gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	}
	return dyn.Resource(gvr).Delete(ctx, name, metav1.DeleteOptions{})
}
