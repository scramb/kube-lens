package main

import (
	"context"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding layer; it delegates to KubeManager.
type App struct {
	ctx  context.Context
	kube *KubeManager
}

func NewApp() *App {
	return &App{kube: NewKubeManager()}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) ListKubeConfigs() []KubeConfigInfo {
	return a.kube.ListKubeConfigs()
}

// AddKubeConfigDialog opens a native file picker and registers the chosen
// kubeconfig. Returns the selected path ("" if cancelled).
func (a *App) AddKubeConfigDialog() (string, error) {
	home, _ := os.UserHomeDir()
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Kubeconfig auswählen",
		DefaultDirectory: filepath.Join(home, ".kube"),
	})
	if err != nil || path == "" {
		return "", err
	}
	if err := a.kube.AddKubeConfig(path); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) RemoveKubeConfig(path string) {
	a.kube.RemoveKubeConfig(path)
}

func (a *App) ListContexts() ([]ContextInfo, error) {
	return a.kube.ListContexts()
}

func (a *App) InitialContext() string {
	return a.kube.InitialContext()
}

func (a *App) UseContext(name string) error {
	return a.kube.UseContext(name)
}

func (a *App) ListNamespaces() ([]string, error) {
	return a.kube.ListNamespaces()
}

func (a *App) GetResourceUISettings(contextName string) ResourceUISettings {
	return a.kube.ResourceUISettings(contextName)
}

func (a *App) SetResourceFavorite(contextName, resourceKey string, favorite bool) ResourceUISettings {
	return a.kube.SetResourceFavorite(contextName, resourceKey, favorite)
}

func (a *App) SetSectionCollapsed(contextName, sectionKey string, collapsed bool) ResourceUISettings {
	return a.kube.SetSectionCollapsed(contextName, sectionKey, collapsed)
}

func (a *App) SetHideEmptyCRDs(hide bool) ResourceUISettings {
	return a.kube.SetHideEmptyCRDs(hide)
}

func (a *App) SetCRDGroupingSettings(settings CRDGroupingSettings) ResourceUISettings {
	return a.kube.SetCRDGroupingSettings(settings)
}

func (a *App) GetTableViewSettings(contextName, resourceKey string) TableViewSettings {
	return a.kube.TableViewSettings(contextName, resourceKey)
}

func (a *App) SetTableViewSettings(contextName, resourceKey string, settings TableViewSettings) TableViewSettings {
	return a.kube.SetTableViewSettings(contextName, resourceKey, settings)
}

func (a *App) DiscoverResources() ([]APIResource, error) {
	return a.kube.DiscoverResources()
}

func (a *App) FluxProblemResources() ([]FluxProblemResource, error) {
	return a.kube.FluxProblemResources()
}

func (a *App) ListResourceTable(group, version, resource, namespace string) (*TableResult, error) {
	return a.kube.ListResourceTable(group, version, resource, namespace)
}

func (a *App) GetResourceQuantities(group, version, resourceName, namespace string, names []string) ([]ResourceQuantityInfo, error) {
	return a.kube.GetResourceQuantities(group, version, resourceName, namespace, names)
}

func (a *App) GetResourceQuantity(group, version, resourceName, namespace, name string) (ResourceQuantitySummary, error) {
	return a.kube.GetResourceQuantity(group, version, resourceName, namespace, name)
}

func (a *App) ResourceHasItems(group, version, resource, namespace string) (bool, error) {
	return a.kube.ResourceHasItems(group, version, resource, namespace)
}

func (a *App) GetResourceYAML(group, version, resource, namespace, name string) (string, error) {
	return a.kube.GetResourceYAML(group, version, resource, namespace, name)
}

func (a *App) DeleteResource(group, version, resource, namespace, name string) error {
	return a.kube.DeleteResource(group, version, resource, namespace, name)
}
