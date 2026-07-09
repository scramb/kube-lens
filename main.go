package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
)

//go:embed all:frontend/dist
var assets embed.FS

// ensureToolPath makes exec-based kubeconfig auth plugins (kubelogin, az,
// gke-gcloud-auth-plugin, …) findable when the app is launched from
// Finder/Dock, where the shell PATH is not inherited.
func ensureToolPath() {
	home, _ := os.UserHomeDir()
	extra := []string{
		"/opt/homebrew/bin",
		"/usr/local/bin",
		filepath.Join(home, ".local", "bin"),
		filepath.Join(home, "go", "bin"),
	}
	path := os.Getenv("PATH")
	for _, p := range extra {
		if !strings.Contains(path, p) {
			path = path + string(os.PathListSeparator) + p
		}
	}
	os.Setenv("PATH", path)
}
