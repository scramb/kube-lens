# Kube Lens

[![Build](https://github.com/scramb/kube-lens/actions/workflows/build.yml/badge.svg)](https://github.com/scramb/kube-lens/actions/workflows/build.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

An interactive Kubernetes desktop UI for macOS, Windows and Linux — built with
[Wails v2](https://wails.io) (Go backend, native webview, no bundled Chromium),
React + TypeScript and [Mantine](https://mantine.dev).

## Features

- **Multi-kubeconfig management** — `~/.kube/config` is always loaded; additional
  kubeconfig files can be added through a native file dialog and are persisted
  across restarts.
- **Context switching** across all loaded kubeconfigs; the last used context is
  reconnected automatically on startup.
- **All standard resources** in the sidebar, grouped by Cluster, Workloads,
  Configuration, Network, Storage and Access Control.
- **Dynamic CRD discovery** — every custom resource is detected via the discovery
  API and grouped by API group, using the same server-side tables (`as=Table`) as
  `kubectl get`, including a CRD's `additionalPrinterColumns`.
- **Structured detail views** — tabbed drawers per resource with a YAML view
  (managed fields stripped), namespace filtering, full-text search and auto-refresh.
- **Flux UI** — browse Flux GitOps resources with inline **Reconcile** and
  **Suspend/Resume** actions.
- **Prometheus metrics** — chart pod and workload metrics with **auto-discovery**
  of an in-cluster Prometheus, or point Kube Lens at a URL **manually**. Everything
  environment-specific (Prometheus URL, tenant headers, label names) is configurable.
- Exec-based auth plugins (kubelogin, `az`, `gke-gcloud-auth-plugin`, …) work even
  when the app is launched from Finder/Dock (PATH is extended at startup).

## Screenshots

_Screenshots coming soon._ <!-- TODO: add screenshots of the main views. -->

## Development

Run the app with hot reload:

```sh
wails dev      # dev mode with hot reload (browser access: http://localhost:34115)
```

Prerequisites: Go ≥ 1.26, Node ≥ 20 and the Wails CLI:

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Building

Produce a production build for your current platform:

```sh
wails build    # output in build/bin/
```

On Windows an NSIS installer can additionally be produced with `wails build -nsis`.

macOS builds are currently **unsigned** (code signing / notarization are not yet
configured).

## Server mode

Kube Lens can also run as a browser-accessible server. This is useful for a
container or a remote host where a native webview is not available:

```sh
KUBE_LENS_AUTH_TOKEN=change-me \
  docker run --rm -p 8399:8399 \
  -e KUBE_LENS_AUTH_TOKEN \
  -e KUBECONFIG=/home/nonroot/.kube/config \
  -v ~/.kube/config:/home/nonroot/.kube/config:ro \
  ghcr.io/scramb/kube-lens:latest
```

Or build/run locally:

```sh
cd frontend && npm ci && npm run build
cd ..
go run -tags server . --server --addr 127.0.0.1:8399 --auth-token change-me
```

Security notes:

- The server exposes the full Kubernetes permissions of the mounted kubeconfig.
  Use a reverse proxy for TLS and network access control.
- A bearer token is required when binding to a non-loopback address. For local
  loopback-only development the token may be omitted.
- Native file dialogs are disabled in server mode. Provide kubeconfigs via
  `KUBECONFIG` or mounted files. Settings can be stored in a mounted directory by
  setting `KUBE_LENS_CONFIG_DIR`.
- Exec-auth plugins referenced by kubeconfigs (for example `kubelogin`, `az` or
  `gke-gcloud-auth-plugin`) must exist inside the container image. Otherwise use
  a kubeconfig that does not depend on external exec plugins.
- The local terminal panel is disabled by default in server mode because it would
  open a shell in the container. Enable it explicitly with
  `--enable-local-terminal` if that is intended. Pod exec remains available.

### Linux system packages

Linux requires the GTK and WebKit development headers:

```sh
sudo apt-get install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
```

## Tech stack

- **Wails v2** — Go backend bound to a native webview (no Chromium bundle)
- **Go + client-go** — kubeconfig merging, discovery, dynamic client and
  server-side table requests
- **React + TypeScript** — UI layer
- **Mantine** — component library

Backend layout:

- `main.go` — Wails bootstrap, window configuration, PATH fix for auth plugins
- `app.go` — binding layer between the frontend and the Kubernetes manager
- `kube.go` — all Kubernetes logic (kubeconfig merging via client-go/clientcmd,
  discovery, dynamic client, server-side tables, settings persistence)
- `flux.go` / `prometheus.go` — Flux and Prometheus integrations
- `frontend/src/` — React UI (sidebar, resource tables, YAML drawer, config modal)

## License

Kube Lens is licensed under the [Apache License 2.0](./LICENSE).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and
PR conventions, and [PLAN.md](./PLAN.md) for the roadmap.
