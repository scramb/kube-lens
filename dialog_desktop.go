//go:build !server

package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func openKubeConfigDialog(ctx context.Context, defaultDirectory string) (string, error) {
	return runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
		Title:            "Kubeconfig auswählen",
		DefaultDirectory: defaultDirectory,
	})
}
