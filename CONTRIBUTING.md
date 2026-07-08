# Contributing to Kube Lens

Thanks for your interest in improving Kube Lens! This guide covers how to get a
local development environment running and how to submit changes.

## Prerequisites

- **Go** 1.26 or newer
- **Node** 20 or newer (with `npm`)
- **Wails CLI**:
  ```sh
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
  Make sure `$(go env GOPATH)/bin` is on your `PATH` so the `wails` command is
  available.

### Linux system packages

On Linux you also need the GTK and WebKit development headers:

```sh
sudo apt-get install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
```

(Package names may differ on non-Debian distributions.)

## Developing

Run the app in development mode with hot reload:

```sh
wails dev
```

The frontend is also reachable in a browser at http://localhost:34115 for
convenient DevTools access.

Frontend dependencies live in `frontend/`; install them with `npm install`
(or `npm ci`) if you work on the UI in isolation.

## Building

Produce a production build for your current platform:

```sh
wails build      # output in build/bin/
```

On Windows an NSIS installer can additionally be produced with
`wails build -nsis`.

## Pull requests

- Branch off `main` and give your branch a short, descriptive name
  (e.g. `feature/pod-logs-filter` or `fix/context-switch-crash`).
- Keep changes focused; one logical change per PR where possible.
- Write a clear PR description explaining **what** changed and **why**.
  Reference related issues where applicable.
- Make sure `wails build` succeeds before opening the PR.

## Roadmap

The planned direction and open work packages are tracked in
[PLAN.md](./PLAN.md). Have a look there before starting larger features to see
what is already planned or in progress.
