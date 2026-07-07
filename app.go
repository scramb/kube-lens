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

func (a *App) DiscoverResources() ([]APIResource, error) {
	return a.kube.DiscoverResources()
}

func (a *App) ListResourceTable(group, version, resource, namespace string) (*TableResult, error) {
	return a.kube.ListResourceTable(group, version, resource, namespace)
}

func (a *App) GetResourceYAML(group, version, resource, namespace, name string) (string, error) {
	return a.kube.GetResourceYAML(group, version, resource, namespace, name)
}

func (a *App) DeleteResource(group, version, resource, namespace, name string) error {
	return a.kube.DeleteResource(group, version, resource, namespace, name)
}
