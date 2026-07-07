# Kube Lens

Interaktive Kubernetes-Desktop-UI für macOS, Windows und Linux — gebaut mit
[Wails v2](https://wails.io) (Go-Backend, natives Webview, kein Chromium-Bundle),
React + TypeScript und [Mantine](https://mantine.dev).

## Features

- **Kubeconfig-Verwaltung**: `~/.kube/config` wird immer geladen; weitere Dateien
  lassen sich über den nativen Datei-Dialog hinzufügen und werden persistiert
  (`~/Library/Application Support/kube-lens/settings.json` bzw. XDG-Config-Dir).
- **Kontext-Wechsel** über alle geladenen Kubeconfigs hinweg; der zuletzt genutzte
  Kontext wird beim Start automatisch verbunden.
- **Alle Standard-Ressourcen** in der Sidebar, gruppiert nach Cluster, Workloads,
  Konfiguration, Netzwerk, Storage und Zugriffskontrolle.
- **CRDs dynamisch**: Alle Custom Resources werden per Discovery-API erkannt und
  nach API-Gruppe gruppiert angezeigt.
- **Server-Side Tables**: Die Tabellen nutzen die Table-API des API-Servers
  (`as=Table`) — dieselben Spalten wie `kubectl get`, inklusive
  `additionalPrinterColumns` von CRDs.
- Namespace-Filter (inkl. „Alle Namespaces"), Volltext-Suche, Auto-Refresh (5 s),
  YAML-Ansicht pro Ressource (managedFields entfernt), Löschen mit Bestätigung.
- Exec-basierte Auth-Plugins (kubelogin, az, gke-gcloud-auth-plugin, …)
  funktionieren auch beim Start aus Finder/Dock (PATH-Erweiterung in `main.go`).

## Entwicklung

```sh
wails dev      # Dev-Modus mit Hot-Reload (Browser-Zugriff: http://localhost:34115)
wails build    # Produktions-Build → build/bin/
```

Voraussetzungen: Go ≥ 1.25, Node ≥ 20, Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`).

## Architektur

- `main.go` — Wails-Bootstrap, Fenster-Konfiguration, PATH-Fix für Auth-Plugins
- `app.go` — Binding-Schicht zwischen Frontend und KubeManager
- `kube.go` — gesamte Kubernetes-Logik: Kubeconfig-Merging (client-go/clientcmd),
  Discovery, dynamischer Client, Server-Side-Table-Requests, Settings-Persistenz
- `frontend/src/` — React-UI (Mantine): Sidebar, ResourceTable, YamlDrawer,
  KubeConfigModal; Sidebar-Gruppierung in `resourceCatalog.ts`
