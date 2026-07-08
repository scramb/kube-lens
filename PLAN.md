# Kube Lens — Feature-Roadmap

> Dieses Dokument ist die geteilte Arbeitsgrundlage über Sessions und Agents hinweg.
> **Konventionen:** Jedes Arbeitspaket hat eine Checkbox und ist so geschnitten, dass es
> unabhängig umsetzbar ist. Wer ein Paket beginnt, markiert es mit `[~]` (in Arbeit),
> fertig ist `[x]`. Abhängigkeiten sind explizit vermerkt. Entscheidungen stehen im
> Abschnitt „Entscheidungslog" — nicht wieder aufmachen, nur ergänzen.

## Kontext

- **Stack:** Wails v2 (Go-Backend, natives Webview) + React/TypeScript + Mantine.
  Entscheidung für Go/client-go statt Tauri/Rust ist final (siehe Entscheidungslog).
- **Architektur heute:**
  - `main.go` — Bootstrap, Fenster, PATH-Fix für exec-Auth-Plugins (kubelogin etc.)
  - `app.go` — Wails-Binding-Schicht (dünne Delegation)
  - `kube.go` — gesamte K8s-Logik: kubeconfig-Merging, Kontexte, Discovery,
    dynamischer Client, Server-Side-Table-Requests, Settings-Persistenz
  - `frontend/src/App.tsx` — State-Orchestrierung, Polling (5 s)
  - `frontend/src/resourceCatalog.ts` — Sidebar-Gruppierung (Standard + CRD-Gruppen)
  - `frontend/src/components/` — Sidebar, ResourceTable, YamlDrawer, KubeConfigModal
- **Settings:** JSON unter `os.UserConfigDir()/kube-lens/settings.json`
  (aktuell: zusätzliche kubeconfigs, lastContext). Neue Features erweitern diese Datei.
- **Tabellen** kommen server-seitig über die Table-API (`as=Table`) — Spalten wie
  `kubectl get`, inkl. `additionalPrinterColumns` von CRDs. Nicht ersetzen.
- Das Projekt wird **Open Source**: keine hartkodierten, firmenspezifischen Annahmen —
  alles Umgebungsabhängige (Prometheus-URL, Tenant-Header, Label-Namen) muss
  konfigurierbar sein.

## Reihenfolge

**A (Sidebar + Details) → C (Flux) → B (Prometheus)** — vom User bestätigt.
C vor B, weil C auf dem A-Fundament sehr günstig ist; B ist der größte Brocken.

**D–H danach, Reihenfolge flexibel** (User: „relativ egal") — sie sind unabhängig
voneinander und können je nach Bedarf oder parallel gezogen werden. Einzige harte
Kopplungen: D und E setzen den Tab-Drawer aus A4 voraus, E nutzt C1, F ersetzt
u. a. das Fast-Polling aus C4.

---

## Milestone A — Sidebar-Neuordnung & strukturierte Detail-Ansichten

**Ziel:** Informationen verdaulicher machen — sowohl die Navigation (CRD-Gruppen mit
Produktnamen statt roher API-Gruppen) als auch die Ressourcen-Details (strukturierte
Übersicht statt YAML-Dump).

### A1 — Sidebar: Produkt-Mapping für CRD-Gruppen
- [x] Statische Mapping-Tabelle in `resourceCatalog.ts`: API-Gruppen-Muster → Produktname
      (`productForGroup`, Suffix-Regeln für fluxcd.io/istio.io/cert-manager.io/kyverno.io).
      Mehrere Gruppen können in eine Sektion münden:
      - `*.toolkit.fluxcd.io` → **Flux**
      - `monitoring.coreos.com` → **Prometheus Operator**
      - `*.istio.io` → **Istio**
      - `cert-manager.io`, `acme.cert-manager.io` → **Cert-Manager**
      - `kyverno.io` → **Kyverno**
      - `external-secrets.io`, `generators.external-secrets.io` → **External Secrets**
      - `gateway.networking.k8s.io` → **Gateway API**
      - Rest: wie bisher unter dem API-Gruppennamen
- [x] Innerhalb einer Produkt-Sektion: bei Kind-Namenskollisionen Gruppenkürzel als
      Suffix anzeigen (nur bei echter Kollision in derselben Sektion).

### A2 — Sidebar: Favoriten & Zustand
- [x] Ressourcen anpinnen (Stern-Icon im NavLink-Hover); Favoriten-Sektion ganz oben.
- [x] Persistenz in Settings **pro Kontext** (`favorites: { [contextName]: gvr[] }`).
- [x] Collapse-Zustand der Sektionen persistieren.
- [x] Optionaler Toggle „leere CRDs ausblenden": Instanz-Count lazy per List mit
      `limit=1` beim Aufklappen der Sektion — kein Vorab-Scan über alle CRDs.

### A3 — Backend: Ressource als JSON + Events
- [x] `GetResourceJSON(...)` → Objekt als JSON-String (zusätzlich zum
      bestehenden `GetResourceYAML`; managedFields entfernt). → `detail.go`
- [x] `GetEventsFor(ns, name, uid)` → Events via Field-Selector auf `involvedObject`
      (core/v1). EventInfo-Typ + Bindings generiert. → `detail.go`

### A4 — Detail-Drawer mit Tabs
Abhängig von: A3.
- [x] Drawer umgebaut auf Tabs: **Übersicht | YAML | Events | Metriken** (Metriken:
      Platzhalter bis Milestone B). Lazy-Loading je Tab, Race-Schutz via reqRef.
- [x] **Übersicht, generische Schicht** (funktioniert für jede Ressource inkl. CRDs):
      MetadataCard + ConditionsTable → `components/detail/GenericOverview.tsx`.
- [x] **Übersicht, Kind-Renderer** (Registry `getOverviewRenderer`, Fallback generisch):
      Pod, Workload (Deploy/StatefulSet/DaemonSet/ReplicaSet), Service,
      ConfigMap/Secret (Werte-Toggle, base64-Dekodierung), Node.
- [x] YAML-Tab: Syntax-Highlighting ergänzen (leichtgewichtiger Read-Only-Renderer
      mit Zeilennummern; CodeMirror bleibt für E2/Editiermodus reserviert).

---

## Milestone C — Interaktive Flux-UI

**Ziel:** Eigene UI für Flux-Ressourcen mit Aktionen (Reconcile, Suspend/Resume) —
Mechanik identisch zur Flux-CLI. **Scope umfasst Image Automation** (User-Entscheidung).

### C1 — Backend: generisches Patchen
Unabhängig umsetzbar; Grundlage auch für spätere Features (YAML-Edit).
- [x] `PatchResource(group, version, resource, ns, name, patchJSON, patchType)`
      über den dynamischen Client (merge/strategic/json). → `patch.go`
- [x] Convenience: `AnnotateResource(...)` und `SetSuspend(..., suspended bool)`
      (JSON via json.Marshal, kein rohes Sprintf). → `patch.go`

### C2 — Flux-Erkennung & Übersichtsseite
Abhängig von: A1 (Flux-Sektion), C1.
- [x] Flux-Bereich (Dashboard-Eintrag in Sidebar) nur bei vorhandenen
      `*.fluxcd.io`-Gruppen. → `fluxAvailable` in App, Sidebar-„Dashboards"-Sektion.
- [x] Übersichtsseite mit Status-Karten (Ready/NotReady/Suspended je Typ),
      gruppiert in Appliers/Sources/Image Automation/Notification. Backend
      `FluxStatus()` aggregiert live. → `flux.go`, `components/flux/*`.
- [x] Klick auf Karte → navigiert zur gefilterten Ressourcenliste (`openFluxKind`).

### C3 — Flux-Listen mit Semantik
Abhängig von: C2.
- [x] Listenansicht: Ready/Status/Age/Revision kommen bereits über die Server-Side-
      Table-API aus den `additionalPrinterColumns` der Flux-CRDs (kubectl-identisch).
- [x] Aktionen: im Detail-Drawer für Flux-Kinds (Reconcile, Reconcile with source,
      Suspend/Resume). → `YamlDrawer.tsx`. Suspend-Badge im Drawer-Titel.
- [ ] Zeilen-Inline-Aktionen (Schnellzugriff ohne Drawer öffnen) — verschoben.

### C4 — Aktions-Mechanik & Feedback
Abhängig von: C1.
- [x] **Reconcile:** Annotation `reconcile.fluxcd.io/requestedAt` (RFC3339Nano now).
      → `flux.go: FluxReconcile`.
- [x] **Reconcile with source:** löst `spec.sourceRef`/`spec.chartRef`/
      `spec.chart.spec.sourceRef` auf, annotiert Source + Ressource. → `FluxReconcileWithSource`.
- [x] **Suspend/Resume:** `spec.suspend` patchen (nutzt `SetSuspend` aus patch.go).
- [x] **Image Automation:** funktioniert generisch — alle `*.fluxcd.io`-Kinds
      (inkl. ImageRepository/ImagePolicy/ImageUpdateAutomation) erhalten dieselben
      Aktionen, da Erkennung über Gruppen-Suffix läuft.
- [ ] Fast-Polling mit observedGeneration-Fortschritt — aktuell leichtes Refetch
      (400 ms) nach Suspend/Resume; volle Progress-Anzeige verschoben (→ mit F).

### C5 — Optional / nachgelagert
- [ ] Dependency-Graph der Kustomizations (`spec.dependsOn`) als Diagramm.

---

## Milestone B — Prometheus-Metriken

**Ziel:** Metriken aus Prometheus-kompatiblen Quellen (Prometheus, Mimir, Thanos, …).
Autodiscovery im Cluster **plus** vollständig manuelle Konfiguration. Alles
umgebungsspezifische ist konfigurierbar (Open-Source-Anforderung, siehe Entscheidungslog).

### B1 — Settings-Modell & Konfigurations-UI
- [x] Settings-Erweiterung **pro Kontext**:
      ```json
      "prometheus": {
        "mode": "auto | manual | off",
        "url": "https://mimir.example.com/prometheus",
        "headers": { "X-Scope-OrgID": "…", "Authorization": "…" },
        "clusterSelector": { "label": "cluster", "value": "mein-cluster" }
      }
      ```
      - `headers`: freie Key-Value-Liste — deckt Mimir-Tenant (`X-Scope-OrgID`),
        Bearer/Basic-Auth und beliebige Proxies ab. **Keine Annahmen über eine
        spezifische Instanz.**
      - `clusterSelector.label`: frei konfigurierbar (`cluster`, `k8s_cluster`, eigene) —
        **nicht hartkodieren.** Leer = kein Matcher (Single-Cluster-Prometheus).
- [x] Konfigurations-Modal (pro Kontext, erreichbar über Header-Settings):
      Modus-Wahl, URL + Header-Editor, Label-Name-Feld, Werte-Dropdown via
      `/api/v1/label/<label>/values`, „Verbindung testen"-Button (Query `up`, zeigt
      Sample-Count und erkannte Cluster-Label-Werte).

### B2 — Backend: Zugriffswege
- [x] **Autodiscovery:** Services clusterweit scannen nach bekannten Signaturen
      (Label `app.kubernetes.io/name in (prometheus, thanos-query, mimir)`, Namens-
      Heuristiken `prometheus-operated`, `*-kube-prometheus-*`, Port `9090`/`web`).
      Kandidatenliste zurückgeben; UI lässt den User bestätigen (kein stilles Raten).
- [x] Zugriff auf In-Cluster-Instanzen über **API-Server-Service-Proxy**
      (`/api/v1/namespaces/<ns>/services/<name>:<port>/proxy/`) — nutzt bestehende
      Kubeconfig-Auth, kein Portmanagement. Konfigurierte Header (z. B. Mimir
      `X-Scope-OrgID`) werden auch über den Proxy weitergereicht.
- [ ] Fallback **Port-Forward** (client-go SPDY), falls Proxy per RBAC verboten
      (403 wird erkannt und im Konfigurations-Modal gemeldet; automatischer
      Port-Forward bleibt offen, um keine instabile Teilimplementierung zu committen).
- [x] Manueller Modus: direkter HTTP-Client mit konfigurierten Headern.

### B3 — Backend: Query-Schicht
Abhängig von: B1, B2.
- [x] Client für `/api/v1/query` und `/api/v1/query_range` mit:
      Matcher-Injektion (`clusterSelector` wird in jede Query eingefügt),
      Timeout, Ergebnis-Cache (~10 s) gegen Polling-Spam.
- [x] Query-Katalog (parametrisiert nach Namespace/Pod/Node), Standard-Metriken:
      cAdvisor (`container_cpu_usage_seconds_total` als Rate,
      `container_memory_working_set_bytes`), kube-state-metrics (Restarts, Phasen),
      node-exporter (Node-CPU/Mem/Disk). Katalog als Datenstruktur, nicht verstreut.

### B4 — Anzeige
Abhängig von: A4 (Metriken-Tab), B3.
- [x] **Tabellen-Spalten:** CPU/Memory in Pod- und Node-Listen (ein Batch-Instant-Query
      pro Refresh, gejoint über Pod/Node-Name).
- [x] **Metriken-Tab im Drawer:** Zeitreihen-Charts (CPU, Memory, Netzwerk; Zeitraum
      1h/6h/24h) mit leichtgewichtigem SVG-Chart (kein zusätzliches Chart-Bundle).
- [x] **Cluster-Übersichtsseite** (oberster Sidebar-Eintrag): Kapazität vs. Nutzung
      (CPU/Mem), Node-Status, Pod-Zähler. Bewusst schlank — kein Grafana-Ersatz.
- [x] **Graceful Degradation:** ohne konfigurierte/erreichbare Quelle verschwinden
      Spalten/Tabs/Seite kommentarlos; Fehlzustand nur im Konfigurations-Modal sichtbar.

**Verifiziert (2026-07-08) live gegen `aks-chatapp-hr-prod-gwc-001`:** Auto-Discovery
findet `monitoring/kube-prometheus-stack-prometheus:http-web`, Verbindungstest ok,
CPU/Memory-Spalten in Pod-Liste, 4 Zeitreihen-Charts (CPU/Mem/Net RX/TX) im Drawer,
Cluster-Übersicht (CPU 4 %, Mem 12 %, Nodes 4/0) — alles mit echten Prometheus-Daten.
Behoben: Header wurden im Proxy-Modus nicht gesendet; Header-Editor jetzt auch im
Auto-Modus verfügbar. Offen bleibt nur der Port-Forward-Fallback (403-Erkennung ist da).

---

## Milestone D — Pod-Logs & Exec-Terminal

**Ziel:** Logs live in der App lesen und Container-Shells öffnen — die zwei
häufigsten „dann doch wieder kubectl"-Momente eliminieren.

### D1 — Backend: Log-Streaming
- [x] `StartPodLogs/StopPodLogs/ListPodContainers` via client-go `GetLogs`
      (`follow=true`, tailLines/previous/timestamps/sinceSeconds). → `app_logs.go`
- [x] Batch-Emit über Wails-Events (`logs:data:<id>`/`logs:end:<id>`/`logs:error:<id>`);
      Cancel via Registry, Streams stoppen bei Tab-/Drawer-Wechsel.

### D2 — Frontend: Logs-Tab im Pod-Drawer
Abhängig von: A4, D1.
- [x] Tab **Logs** (nur Pods): Container-Dropdown (inkl. initContainers), Follow +
      Auto-Scroll-Pause bei Hochscrollen, Filter, Umbruch, Previous, Download.
      → `components/logs/LogsTab.tsx`. Live gegen Cluster verifiziert.
- [x] Zeilen-Cap 5000 statt Virtualisierung (bewusst; reicht, kein DOM-Kollaps).

### D3 — Exec-Terminal
Abhängig von: A4.
- [x] Backend: `remotecommand.NewSPDYExecutor` (TTY), stdin via `ExecWrite`,
      stdout/stderr per Events, Resize via `ExecResize`. → `app_exec.go`
- [x] Frontend: xterm.js im Tab **Terminal** (nur Pods), Container-/Shell-Auswahl
      (/bin/sh · /bin/bash · /bin/ash). → `components/terminal/TerminalTab.tsx`.
      Live verifiziert (Root-Shell-Prompt im Container erhalten).

---

## Milestone E — YAML bearbeiten & anwenden

**Ziel:** Ressourcen direkt aus der App ändern und neu anlegen — Server-Side Apply,
damit Feld-Ownership sauber bleibt.

### E1 — Backend: Apply
Abhängig von: C1 (gleiche Infrastruktur-Schicht).
- [x] `ApplyResourceYAML(yaml, dryRun, force)` via dynamischem Client, Server-Side
      Apply, `FieldManager: "kube-lens"`; GVK→GVR via discovery-RESTMapper (auch CRDs);
      Konflikte werden gemeldet, `force` als Option. → `apply.go`
- [x] Dry-Run-Variante (`DryRunAll`) für Validierung vor dem echten Apply.

### E2 — Frontend: editierbarer YAML-Tab
Abhängig von: A4, E1.
- [x] YAML-Tab mit CodeMirror 6 (YAML-Syntax, dark), Dirty-State, „Prüfen (Dry-Run)"
      → „Anwenden", bei Konflikt „Mit Force anwenden"; Fehler inline.
      → `components/editor/YamlEditor.tsx`. Editor live im Drawer verifiziert.
- [x] Zurücksetzen-Button bei ungespeicherten Änderungen.

### E3 — Ressourcen neu anlegen
Abhängig von: E1.
- [x] „+"-Button in der Kopfleiste öffnet `NewResourceModal` mit Kind-Skeleton;
      onCreated lädt die Tabelle neu. → `components/editor/NewResourceModal.tsx`.

---

## Milestone F — Watch-Streams statt Polling

**Ziel:** Echte Live-Updates; das 5-Sekunden-Polling und das Fast-Polling nach
Flux-Aktionen (C4) ersetzen.

### F1 — Backend: Watch-Manager
- [x] `StartResourceWatch/StopResourceWatch` (GVR + Namespace), dynamic-Watch,
      Registry, Start/Stop vom Frontend. → `watch.go`
- [x] **Ansatz revidiert (Entscheidungslog):** statt Table-Watch neu zu bauen,
      emittiert der Watch ein debounced `watch:changed:<id>`; das Frontend lädt
      die bestehende Server-Side-Tabelle neu → kein zweiter Rendering-Pfad.
      Debounce auf 2 s gesetzt (verhindert Refresh-Storm bei hoher Churn-Rate).
- [x] Robustheit: Reconnect mit Backoff, Kanal-/Fehler-/410-Handling via Relist.

### F2 — Frontend: Subscription statt Interval
Abhängig von: F1.
- [x] Tabellen-Effekt startet Watch + lädt bei `watch:changed` neu; festes 5s-Poll
      ersetzt durch 20s-Fallback-Poll (falls Watch per RBAC verboten). → `App.tsx`
- [ ] Inkrementelles add/update/delete + Live-Drawer-Update — bewusst nicht gebaut
      (Reload der Server-Side-Tabelle ist einfacher/robuster). Flux-Fast-Polling
      bleibt vorerst (harmlos, nur nach Aktion).

---

## Milestone G — CI, Releases & Cross-Platform-Builds

**Ziel:** Reproduzierbare Builds für macOS, Windows, Linux — Voraussetzung fürs
Open-Source-Release.

### G1 — Repo-Grundlagen
- [x] `git init` + Commits vorhanden; `.gitignore` deckt build/bin, node_modules,
      frontend/dist ab (wailsjs bleibt committet). LICENSE (Apache-2.0),
      CONTRIBUTING.md, README (englisch, OSS) angelegt. → Milestone-G-Agent
- [ ] GitHub-Repo anlegen + README-Badge-Owner (`OWNER`) ersetzen — manueller
      Schritt beim Veröffentlichen (kein Remote in dieser Umgebung).

### G2 — Build-Pipeline
Abhängig von: G1.
- [x] `.github/workflows/build.yml`: Matrix macos/windows/ubuntu, Go 1.26 + Node 20,
      Linux-GTK/WebKit-Pakete, `wails build`, Artefakt-Upload.
- [x] Windows-NSIS im Release-Workflow (`wails build -nsis`).

### G3 — Release-Workflow
Abhängig von: G2.
- [x] `.github/workflows/release.yml`: Tag `v*` → Build aller Plattformen,
      SHA256SUMS, GitHub Release via `action-gh-release`.
- [ ] macOS Signing/Notarization offen (kein Apple-Account) — unsigned dokumentiert.

---

## Milestone H — Internationalisierung (i18n)

**Ziel:** Englisch als Default fürs Open-Source-Release, Deutsch als zweite Locale.

### H1 — Infrastruktur
- [x] `react-i18next` + `i18next-browser-languagedetector`; `src/i18n/index.ts`
      merged Bundles aus `src/i18n/gen/*.ts` via `import.meta.glob` (konfliktfreie
      Erweiterung). Englisch = Fallback. Alle sichtbaren UI-Strings über `t()`
      in 21 Komponenten; Ressourcen in gen/shell|detail|dashboards|forms.ts (EN+DE).
- [x] **Backend-Fehlermeldungen entdeutschen:** kube.go/apply.go/watch.go geben
      jetzt englische Fehlertexte zurück.

### H2 — Sprachwahl & Formate
Abhängig von: H1.
- [x] Sprachumschalter im Einstellungsmenü (Deutsch/English); Default =
      Systemsprache (LanguageDetector), Persistenz in localStorage (`kube-lens-lang`).
- [ ] `Intl`-Datums-/Zahlenformatierung an Locale koppeln — offen (aktuell
      `toLocaleString()` ohne explizite Locale; niedrige Priorität).

**Verifiziert (2026-07-08) live:** EN/DE-Umschaltung über Shell, Sidebar (inkl.
Sektions-Labels), Detail-Drawer-Tabs (Overview/Metrics ↔ Übersicht/Metriken),
Kind-Renderer, Dashboards, Modals — keine rohen Keys, kein deutsches Restliteral.

## Entscheidungslog

| Datum | Entscheidung |
|---|---|
| 2026-07-07 | Stack: Wails v2 + Go/client-go statt Tauri/Rust — vom User explizit bestätigt, nicht wieder aufmachen |
| 2026-07-07 | Reihenfolge A → C → B vom User bestätigt |
| 2026-07-07 | Prometheus: keine instanzspezifischen Annahmen — Tenant-Header & Auth als freie Header-Liste konfigurierbar |
| 2026-07-07 | Cluster-Label-Name für Metrik-Selektion frei konfigurierbar (Open-Source-Projekt) |
| 2026-07-07 | Flux-Scope inklusive Image Automation (ImageRepository, ImagePolicy, ImageUpdateAutomation) |
| 2026-07-07 | Tabellen bleiben auf Server-Side-Table-API; Metrik-Spalten werden clientseitig dazugejoint |
| 2026-07-07 | Geparkte Ideen als Milestones D–H aufgenommen; Reihenfolge D–H flexibel (User: „relativ egal"), nur technische Abhängigkeiten beachten |
| 2026-07-07 | YAML-Editor: CodeMirror 6 statt Monaco (Bundle-Größe/Startzeit) |
| 2026-07-07 | i18n: Englisch wird Default-Sprache, Deutsch zweite Locale; Backend-Fehlertexte werden englisch/strukturiert |
| 2026-07-08 | Watch (F): statt Table-Watch neu zu bauen, emittiert der Watch ein debounced `watch:changed`-Signal; Frontend lädt die bestehende Server-Side-Tabelle neu. Debounce 2 s gegen Refresh-Storm bei hoher Churn-Rate; 20 s Fallback-Poll wenn Watch per RBAC verboten. |
| 2026-07-08 | Logs (D2): Zeilen-Cap 5000 statt Virtualisierungs-Lib — genügt, keine Extra-Abhängigkeit. |
| 2026-07-08 | i18n (H): Locale-Bundles je Bereich unter `src/i18n/gen/*.ts` (EN+DE zusammen), Auto-Merge via `import.meta.glob` — erlaubt konfliktfreie parallele Bearbeitung. Sprach-Persistenz in localStorage statt settings.json (reine UI-Präferenz). |
