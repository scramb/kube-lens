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

**A–J sind abgeschlossen (Stand 2026-07-08).** Neu geplant: **K (konfigurierbare
CRD-Gruppen & Icons)**, **L (Table-Spalten & Request/Limit-Sichtbarkeit)**,
**M (Flux Failed/NotReady Übersicht)** und **N (Pod Environment Variables Tab)**.
K baut auf A1/A2 auf (`resourceCatalog.ts`, Sidebar-Settings). L baut auf der
Server-Side-Table-API aus B4 und dem Metrics-Drawer aus J auf. M baut auf C2/C3
und dem Flux-Dashboard auf. N baut auf dem Pod-Detail-Drawer aus A4 und den Pod-
Tabs aus D2/D3 auf. K, L, M und N sind unabhängig voneinander und unabhängig von
den offenen Optional-Punkten C3/C4/C5/B2/F2/J3.

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

## Milestone I — Integriertes Terminal-Panel

**Ziel:** Ein Terminal-Panel am unteren Rand der App (VS-Code-artig) mit Tab-Leiste
und „+"-Button. Mehrere Terminals gleichzeitig, jedes an den Kubernetes-Kontext
gepinnt, der beim Öffnen aktiv war — `kubectl` zeigt darin automatisch auf den
richtigen Cluster.

**Kernentscheidung (siehe Entscheidungslog):** Der Kontext wird NICHT über
`kubectl config use-context` gesetzt (das würde die globale `~/.kube/config`
mutieren und alle anderen Shells umstellen). Stattdessen erhält jedes Terminal
eine **temporäre, geflattete kubeconfig** mit gesetztem `current-context` und
`KUBECONFIG=<tempfile>` in seiner Prozess-Umgebung.

### I1 — Backend: PTY-Session-Manager
- [x] Lokale Shell als PTY starten: Unix via `creack/pty`; Windows via ConPTY
      (Abstraktion z. B. `aymanbagabas/go-pty` evaluiert und umgesetzt — eine Lib
      für beide statt zwei Codepfade). Shell = `$SHELL` (Fallback `/bin/zsh` →
      `/bin/bash` → `/bin/sh`), Windows: PowerShell.
- [x] Session-Registry nach dem Muster von `app_exec.go` (`term-<n>`-IDs):
      `StartLocalTerminal(contextName)`, `LocalTerminalWrite(id, data)`,
      `LocalTerminalResize(id, cols, rows)`, `StopLocalTerminal(id)`.
- [x] Output über Wails-Events `term:data:<id>` (string) und `term:end:<id>`;
      Batch-/Flush-Verhalten wie beim Log-Streaming.
- [x] Arbeitsverzeichnis = Home; Umgebung erbt den PATH-Fix aus `main.go`
      (kubelogin/az bleiben auffindbar).

### I2 — Backend: Kontext-Pinning via temporärer kubeconfig
Abhängig von: I1.
- [x] Beim Start: gemergte Config der geladenen kubeconfigs laden
      (`loadingRules().Load()`), per `api.FlattenConfig` inlinen,
      `CurrentContext` auf den übergebenen Kontext setzen,
      via `clientcmd.WriteToFile` in `os.TempDir()/kube-lens/term-<id>.yaml`
      schreiben (0600) und `KUBECONFIG` im PTY-Env setzen.
- [x] Aufräumen: Temp-Datei bei `StopLocalTerminal` und beim App-Shutdown
      (`OnShutdown`-Hook in main.go: alle Sessions stoppen) löschen.
- [x] Exec-Auth beachten: Flatten behält exec-Plugin-Referenzen (kubelogin) —
      funktioniert, weil nur Kommando-Referenzen, keine Secrets kopiert werden.

### I3 — Frontend: Bottom-Panel mit Tabs
Abhängig von: I1.
- [x] Panel am unteren Rand (Mantine AppShell-Footer oder Flex-Bereich im Main):
      einklappbar (Toggle-Icon im Header + Klick auf Leiste), Höhe per
      Drag-Handle verstellbar (Persistenz der Höhe in localStorage).
- [x] Tab-Leiste: ein Tab je Terminal mit Shell-Name + **Kontext-Badge**
      (Terminals bleiben beim Kontext-Wechsel der App offen und behalten ihren
      gepinnten Kontext — das Badge macht das sichtbar), Close-Button je Tab,
      **„+"-Button** öffnet ein neues Terminal mit dem aktuell gewählten Kontext.
- [x] xterm.js-Instanz je Tab (Dependency aus D3 vorhanden; FitAddon,
      Resize-Handling wie `TerminalTab.tsx`); inaktive Tabs bleiben gemountet
      (kein Verbindungsabbruch beim Tab-Wechsel).
- [x] i18n für alle neuen Strings (`shell.terminal.*` in gen/shell.ts oder
      eigene gen/terminalPanel.ts).

### I4 — Lifecycle & Kanten
Abhängig von: I1–I3.
- [x] Beim App-Beenden alle PTY-Sessions terminieren (kein Zombie-Prozess).
- [x] Shell-Exit (User tippt `exit`) → Tab zeigt „beendet"-Zustand und lässt
      sich schließen/neu starten.
- [x] Sinnvolle Obergrenze (z. B. 12 Terminals) mit Hinweis statt hartem Fehler.
- [x] Kein Kontext verbunden → „+" deaktiviert mit Tooltip.

---

## Milestone J — Metrik-Charts: Achsen & Skalierung

**Ziel:** Die Zeitreihen-Charts (Metriken-Tab im Drawer) bekommen sichtbare
Achsen-Skalierung: Y-Achsen-Ticks mit einheitenbewusster Formatierung und
X-Achsen-Zeitmarken. Der leichtgewichtige SVG-Ansatz bleibt (Entscheidungslog:
kein Chart-Bundle) — `SimpleTimeSeriesChart.tsx` wird erweitert, nicht ersetzt.

### J1 — Y-Achse: Ticks, Gridlines, Einheiten
- [x] „Nice numbers"-Tick-Berechnung (3–5 Ticks zwischen min/max, auf runde
      Werte gerundet — bei bytes auf 2er-Potenzen-freundliche Stufen achten).
- [x] Tick-Labels links, formatiert über das vorhandene `formatMetricValue`
      (cores → `500m`, bytes → `1.5 Gi`, bytes/s → `2.0 Mi/s`); horizontale
      Gridlines dezent (`--mantine-color-dark-4`).
- [x] Linkes Padding dynamisch an der breitesten Label-Breite ausrichten
      (grobe Zeichenbreiten-Schätzung reicht, kein Text-Measuring nötig).

### J2 — X-Achse: Zeitmarken
- [x] 3–4 Zeit-Ticks (Anfang/Mitte/Ende bzw. gleichverteilt) aus den
      Punkt-Timestamps; Format via `Intl.DateTimeFormat` mit aktiver
      i18n-Locale — `HH:mm` bei 1h/6h, `HH:mm` + Tageswechsel-Markierung bei 24h.
- [x] Erledigt damit auch den offenen H2-Punkt „Intl-Formatierung an Locale
      koppeln" für die Charts.

### J3 — Hover-Auslesung (optional, nachgelagert)
- [ ] Crosshair + Tooltip: bei Mausbewegung nächstliegenden Punkt markieren,
      Wert + Zeitpunkt anzeigen (reines SVG/DOM, keine Lib).

---

## Milestone K — Konfigurierbare CRD-Gruppen & Custom Icons

**Ziel:** Die Sidebar-Gruppierung für CRDs ist nicht mehr nur statisch in
`resourceCatalog.ts` verdrahtet, sondern pro User/Installation konfigurierbar. Für
jede Gruppe kann zusätzlich ein eigenes Icon gesetzt werden, damit produkt- oder
team-spezifische CRDs visuell erkennbar sind. Die bestehenden Default-Mappings aus
A1 bleiben als Fallback erhalten, damit die App ohne Konfiguration unverändert
funktioniert.

### K1 — Settings-Modell: CRD-Gruppen-Regeln
- [x] Settings um eine neue, globale UI-Konfiguration erweitern (nicht pro Kontext,
      weil API-Gruppen produkt-/tool-bezogen sind und mehrere Cluster betreffen):
      ```json
      "crdGrouping": {
        "rules": [
          {
            "id": "flux",
            "label": "Flux",
            "patterns": ["*.toolkit.fluxcd.io"],
            "icon": "custom:flux"
          }
        ]
      }
      ```
      `id` stabil für Persistenz/Collapse/Favoriten-Anzeige; `label` sichtbar;
      `patterns` unterstützen exakte API-Gruppen und einfache Wildcards/Suffixe wie
      `*.example.com`; `icon` referenziert eine Icon-Quelle aus K2.
- [x] Merge-Regeln definieren: User-Regeln haben Vorrang vor Defaults; wenn eine
      API-Gruppe auf mehrere Regeln passt, gewinnt die erste User-Regel, danach die
      erste Default-Regel. Nicht passende CRDs fallen weiterhin auf den rohen
      API-Gruppennamen zurück.
- [x] Migration/Backward-Compatibility: bestehende Settings ohne `crdGrouping`
      bleiben gültig; vorhandene Collapse-/Favorite-Daten werden nicht verworfen.

### K2 — Icon-Modell & sichere Persistenz
Abhängig von: K1.
- [x] Unterstützte Icon-Typen festlegen und validieren:
      - Built-in Icon-Key (z. B. `tabler:box`, `tabler:git-branch`) für einfache Auswahl.
      - Custom SVG als String oder Data-URL für produktnahe Icons.
      - Optional: Emoji/Text-Fallback für sehr einfache Setups.
- [x] Sicherheitsregeln für Custom SVGs: keine Skripte/Event-Handler/externen
      Referenzen; Rendering über eine sanitizte Komponente oder als geprüftes
      inline SVG. Fehlerhafte Icons fallen auf ein neutrales Default-Icon zurück.
- [x] Größe/Format begrenzen (z. B. max. wenige KB pro Icon), damit `settings.json`
      nicht unkontrolliert wächst.

### K3 — Frontend: Resource-Catalog auf konfigurierbare Regeln umbauen
Abhängig von: K1, K2.
- [x] `resourceCatalog.ts` so refactoren, dass Default-Regeln und Settings-Regeln
      denselben Matcher-Pfad verwenden (keine doppelte Logik). Bestehende
      `productForGroup`-Defaults werden in Default-Regeln überführt.
- [x] Sidebar-Sektionsmodell um `groupId`, `groupLabel`, `groupIcon` erweitern;
      Anzeige nutzt Icon pro Gruppe, inklusive Favoriten- und CRD-Sektionen.
- [x] Kollisionslogik aus A1 beibehalten: Kind-Namenskollisionen werden weiterhin nur
      innerhalb der final gemergten Gruppe mit Gruppenkürzel/Suffix aufgelöst.

### K4 — Config-UI für Gruppen & Icons
Abhängig von: K1–K3.
- [x] Einstellungs-Modal um einen Bereich „CRD-Gruppen" erweitern: Liste der Regeln,
      Reihenfolge per Up/Down oder Drag, Aktivieren/Deaktivieren, Hinzufügen,
      Bearbeiten, Löschen/Zurücksetzen auf Default.
- [x] Regel-Editor: Label, Pattern-Liste, Icon-Auswahl/Upload bzw. SVG-Eingabe,
      Live-Vorschau des Gruppennamens und Icons.
- [x] Validierung mit verständlichen Fehlern: leeres Label, ungültige Pattern,
      doppelte IDs/Labels, zu großes/unsicheres SVG, Regel ohne Pattern.
- [x] „Preview gegen aktuellen Cluster": zeigt API-Gruppen/Kinds, die durch die
      aktuelle Regel betroffen wären, ohne die Settings sofort zu speichern.

### K5 — i18n, Reset & UX-Kanten
Abhängig von: K4.
- [ ] Alle neuen UI-Strings in EN/DE ergänzen (`src/i18n/gen/...`); Default-Regel-Namen
      bleiben übersetzbar, User-Labels werden unverändert angezeigt.
- [ ] Reset-Optionen: einzelne Regel zurücksetzen/löschen und komplette
      CRD-Gruppen-Konfiguration auf App-Defaults zurücksetzen.
- [ ] Kantenfälle behandeln: Icon fehlt/ungültig, alle Regeln deaktiviert, Pattern
      matcht keine vorhandene API-Gruppe, mehrere Regeln matchen dieselbe Gruppe,
      sehr viele CRDs/Regeln ohne merkliche Sidebar-Verlangsamung.

### K6 — Tests & Verifikation
Abhängig von: K1–K5.
- [ ] Unit-Tests für Pattern-Matching, Priorität/Merge von User- und Default-Regeln,
      Fallback auf API-Gruppennamen, Kollisionssuffixe und Icon-Sanitizing.
- [ ] UI-/Komponententests für Regel-Editor, Validierungsfehler, Reset und
      Sidebar-Rendering mit Custom Icons.
- [ ] Manuelle Verifikation gegen einen Cluster mit Flux/Prometheus/Istio- oder
      Dummy-CRDs: Defaults unverändert, neue Custom-Gruppe greift, Icon wird korrekt
      angezeigt, Settings persistieren über App-Neustart.

---

## Milestone L — Table-Spalten & Request/Limit-Sichtbarkeit

**Ziel:** Tabellen werden stärker an den Arbeitsstil des Users anpassbar: Spalten in
der Table View können per Drag & Drop umsortiert und persistiert werden. Zusätzlich
werden Kubernetes Resource Requests/Limits sichtbar gemacht — sowohl als Kontext in
den Metriken als auch als zusätzliche Tabellenspalten für Workloads.

### L1 — Settings-Modell: Spaltenreihenfolge pro Ressource
- [x] Settings um eine pro Kontext und Ressource gespeicherte Table-Konfiguration
      erweitern, z. B.:
      ```json
      "tables": {
        "<contextName>": {
          "apps/v1/deployments": {
            "columnOrder": ["Name", "Namespace", "Ready", "CPU", "Memory"],
            "hiddenColumns": []
          }
        }
      }
      ```
      Keying über GVR/GVK stabil definieren; Server-Side-Table-Spaltennamen bleiben
      Grundlage, damit CRD-`additionalPrinterColumns` weiter funktionieren.
- [x] Merge-Verhalten definieren: neue Server-Side-Spalten werden automatisch hinten
      angehängt; entfernte/umbenannte Spalten werden ignoriert, aber nicht fatal;
      App-eigene Zusatzspalten (Metrics, Requests/Limits) werden in denselben
      Ordnungsmechanismus integriert.
- [x] Reset-Möglichkeit pro Ressource: Spaltenreihenfolge auf Server/API-Default
      plus App-Zusatzspalten zurücksetzen.

### L2 — Frontend: Drag-&-Drop-Spalten in der Table View
Abhängig von: L1.
- [x] `ResourceTable` um Drag-&-Drop für Header-Zellen erweitern; horizontales Ziehen
      ändert nur die Reihenfolge, nicht Sortierung/Filter/Row-Click-Verhalten.
- [x] Persistenz nach Drop in Settings schreiben; Wechsel zwischen Ressourcen und
      App-Neustart behalten die Reihenfolge bei.
- [x] UX-Kanten: erste Spalte/Name sinnvoll greifbar lassen, Actions-/Inline-Spalten
      falls vorhanden separat behandeln, Drag-Handle oder Cursor klar anzeigen,
      Tastatur-/Reset-Fallback anbieten.
- [x] i18n für neue Labels/Tooltips/Reset-Aktion ergänzen.

### L3 — Backend/Frontend: Requests & Limits aus Pod-Specs normalisieren
- [x] Gemeinsame Datenstruktur für Resource Requests/Limits definieren:
      CPU Request, CPU Limit, Memory Request, Memory Limit, jeweils Summe über
      Container; Init-Container-Regeln korrekt berücksichtigen (effektiver Pod-Wert =
      max(sum(app containers), max(init containers)) pro Resource).
- [x] Pod-Listen um App-Zusatzspalten für Requests/Limits erweitern, sofern gepflegt:
      CPU Request, CPU Limit, Memory Request, Memory Limit. Darstellung mit denselben
      Formatierungsfunktionen wie Metrics (`m`, `Mi`, `Gi`).
- [x] Fehlende Werte klar, aber unaufdringlich darstellen (`—`), ohne Tabellen mit
      leeren Zusatzspalten zu überladen; ggf. Spalten nur anzeigen, wenn mindestens ein
      sichtbarer Datensatz Werte enthält oder User sie explizit aktiviert.

### L4 — Workload-Tabellen: Limits/Requests für Deployments, StatefulSets, DaemonSets, ReplicaSets
Abhängig von: L3.
- [x] Für Workloads die PodTemplate-Spec (`spec.template.spec.containers` und
      `initContainers`) auswerten und Requests/Limits aggregieren.
- [x] Tabellen für Deployments, StatefulSets, DaemonSets und ReplicaSets um die
      gleichen Request/Limit-Spalten erweitern: CPU Request, CPU Limit, Memory
      Request, Memory Limit.
- [x] Semantik dokumentieren/anzeigen: Werte sind pro Pod-Template, nicht auf Replica-
      Anzahl hochgerechnet. Optional ergänzend prüfen, ob zusätzlich „total requested"
      sinnvoll ist; falls ja als separater späterer Punkt statt heimlich andere
      Bedeutung in dieselbe Spalte zu legen.

### L5 — Metrics-Drawer: Requests/Limits als Kontext anzeigen
Abhängig von: L3.
- [x] Im Metriken-Tab für Pods CPU-/Memory-Requests und Limits anzeigen, wenn gesetzt:
      als horizontale Referenzlinien in den Charts und/oder kompakte Summary oberhalb
      der Charts.
- [x] Einheiten sauber matchen: CPU-Chart gegen CPU request/limit, Memory-Chart gegen
      Memory request/limit; keine Linien in Netzwerk-Charts.
- [x] Bei fehlenden Prometheus-Daten, aber vorhandenen Requests/Limits: Metriken-Tab
      soll weiterhin sinnvoll degradieren (z. B. Summary sichtbar, Charts verborgen
      oder leerer Zustand mit Hinweis im Tab).
- [ ] Optional für Workloads im Drawer prüfen: Requests/Limits aus PodTemplate auch in
      der Übersicht oder im Metrics-Kontext anzeigen, ohne Pod-Live-Metriken mit
      Template-Werten zu vermischen.

### L6 — Tests & Verifikation
Abhängig von: L1–L5.
- [ ] Unit-Tests für Spalten-Merge/Reihenfolge, Reset, neue Server-Side-Spalten und
      verschwundene Spalten.
- [ ] Unit-Tests für Resource-Aggregation inkl. mehrere Container, Init-Container,
      fehlende Requests/Limits, CPU milli/decimal und Memory binary units.
- [ ] UI-/Komponententests für Header-Drag-&-Drop, Persistenz, Reset und Rendering der
      Request/Limit-Spalten.
- [ ] Manuelle Verifikation gegen Workloads mit gepflegten und nicht gepflegten
      Requests/Limits: Pod-Tabelle, Deployment/StatefulSet/DaemonSet/ReplicaSet-
      Tabellen, Metrics-Drawer und App-Neustart-Persistenz.

---

## Milestone M — Flux Failed/NotReady Übersicht

**Ziel:** Im Flux-Dashboard soll ein direkter Einstieg in eine zentrale
Fehlerübersicht möglich sein. Dort sind alle fehlgeschlagenen bzw. nicht bereiten
Flux-Ressourcen auf einen Blick sichtbar — getrennt nach Ressourcentyp über
Row-Header/Abschnittszeilen, statt dass der User jede Flux-Kind-Liste einzeln öffnen
muss.

### M1 — Datenmodell: Failed/NotReady Flux-Ressourcen aggregieren
- [x] Bestehende Flux-Erkennung aus C2/C3 wiederverwenden: alle `*.fluxcd.io`-Kinds
      einbeziehen, insbesondere Appliers, Sources, Image Automation und Notification.
- [x] Backend- oder Frontend-Aggregation definieren, die pro Ressource mindestens
      Kind, Namespace, Name, Ready-Status, Suspended-Status, Message/Reason, Age,
      Revision/Artifact sofern vorhanden und GVR enthält.
- [x] Filterlogik eindeutig festlegen: aufnehmen, wenn `Ready != True`, ein
      `NotReady`/`False`-Condition vorhanden ist oder die bestehende Flux-Status-
      Aggregation die Ressource als failed/not ready zählt. Suspended separat sichtbar
      machen, aber nicht stillschweigend als Fehler werten.

### M2 — Dashboard-Einstieg: Klick auf Failed/NotReady-Karten
Abhängig von: M1.
- [x] Flux-Dashboard-Karten für Failed/NotReady klickbar machen; Klick öffnet die neue
      zentrale Fehlerübersicht statt nur eine einzelne Kind-Liste.
- [x] Leerer Zustand: Wenn keine failed/not ready Ressourcen vorhanden sind,
      positive Empty-State-Ansicht im Flux-Bereich anzeigen.
- [x] Navigation so bauen, dass Zurück/Sidebar-Zustand konsistent bleibt und ein
      Refresh nach Flux-Aktionen die Übersicht aktualisiert.

### M3 — UI: Gruppierte Übersicht mit Row-Headern
Abhängig von: M1, M2.
- [x] Neue Flux-Fehlerübersicht als Tabelle/Liste mit Row-Headern pro Flux-Kind bzw.
      Kategorie (z. B. Kustomizations, HelmReleases, GitRepositories,
      ImageUpdateAutomations). Jede Gruppe zeigt Count und Status-Zusammenfassung.
- [x] Unter jedem Row-Header die betroffenen Ressourcen als klickbare Zeilen anzeigen:
      Namespace, Name, Status/Reason, Message, Age, Revision und relevante Source-
      Informationen soweit verfügbar.
- [x] Row-Header einklappbar machen und optional initial alle Gruppen mit Fehlern
      geöffnet anzeigen; Gruppen ohne Fehler ausblenden.
- [x] Klick auf eine Ressourcenzeile öffnet den bestehenden Detail-Drawer für genau
      diese Flux-Ressource; bestehende Aktionen (Reconcile, Reconcile with source,
      Suspend/Resume) bleiben erreichbar.

### M4 — Status-Details & Priorisierung
Abhängig von: M3.
- [x] Lange Flux-Condition-Messages kompakt darstellen (einzeilig mit Tooltip/
      Expand), damit die Übersicht scannbar bleibt.
- [x] Sortierung innerhalb der Gruppen definieren: NotReady/Failed zuerst, dann ggf.
      Suspended/Unknown, danach Namespace/Name oder zuletzt geänderte Ressource,
      abhängig von vorhandenen Daten.
- [x] Unterschiedliche Zustände visuell klar trennen: Failed/NotReady, Unknown,
      Suspended, Reconciling/Progressing.
- [ ] Optional: Schnellfilter für Namespace, Kind und Freitext in Name/Message.

### M5 — Live-Updates, i18n & Tests
Abhängig von: M1–M4.
- [x] Bestehende Refresh-/Watch-Mechanik nutzen, damit die Fehlerübersicht nach
      Reconcile/Suspend/Resume und Watch-Events aktualisiert wird; kein separater
      aggressiver Polling-Pfad.
- [x] Alle neuen UI-Strings in EN/DE ergänzen (`src/i18n/gen/dashboards.ts` oder
      passendes neues Bundle).
- [ ] Unit-Tests für Failed/NotReady-Filterung, Suspended-Semantik, Gruppierung und
      Sortierung.
- [ ] UI-/Komponententests für Dashboard-Klick, Empty-State, Row-Header-Gruppen,
      Detail-Drawer-Öffnung und Message-Kürzung.
- [ ] Manuelle Verifikation gegen Flux-Ressourcen mit Ready=True, Ready=False,
      Reconciling/Unknown und Suspended: Dashboard-Counts stimmen, zentrale Übersicht
      zeigt nur relevante Ressourcen und Gruppen korrekt getrennt.

---

## Milestone N — Pod Environment Variables Tab

**Ziel:** Beim Öffnen eines Pods über die Sidebar/Table View bekommt der Pod-Detail-
Drawer einen zusätzlichen Tab **Environment Variables**. Dort sind alle Environment-
Variablen der Container übersichtlich sichtbar, inklusive Quellen aus `env`,
`envFrom`, ConfigMaps, Secrets und Downward API. Secret-Werte werden standardmäßig
maskiert und erst nach explizitem Klick angezeigt. Eine fuzzy Suche filtert schnell
nach Name, Wert, Container und Quelle.

### N1 — Backend: Environment-Variablen für Pods auflösen
- [ ] Neues Binding z. B. `GetPodEnvironment(namespace, podName)` oder Erweiterung der
      Detail-JSON-Schicht definieren, das Pod-Spec und referenzierte ConfigMaps/Secrets
      im selben Namespace ausliest.
- [ ] Datenmodell pro Eintrag festlegen: Container/InitContainer/EphemeralContainer,
      Env-Name, Wert bzw. maskierter Secret-Platzhalter, Quelle (`literal`,
      `configMapKeyRef`, `secretKeyRef`, `envFrom configMap`, `envFrom secret`,
      `fieldRef`, `resourceFieldRef`), optional key/name/prefix und Auflösungsstatus.
- [ ] `envFrom` vollständig expandieren: ConfigMap-/Secret-Keys mit Prefix anwenden;
      fehlende optionale Quellen nicht als Fehler behandeln, fehlende nicht-optionale
      Quellen als Warnung pro Eintrag/Quelle zurückgeben.
- [ ] Secret-Werte nur im Backend laden, wenn sie für Reveal gebraucht werden, oder im
      Response getrennt als sensitive markiert behandeln; keine Secret-Werte in Logs,
      Fehlertexten oder dauerhaftem Frontend-State persistieren.

### N2 — Secret-Reveal-Mechanik
Abhängig von: N1.
- [ ] Secret-Einträge standardmäßig maskiert anzeigen (`••••••••`) mit klarem
      Source-Hinweis, Secret-Name und Key.
- [ ] Reveal nur per explizitem Klick pro Wert oder pro Zeile; kein globales
      automatisches Entmaskieren beim Tab-Öffnen.
- [ ] Optionalen „Hide again"-Pfad vorsehen; beim Schließen des Drawers, Pod-Wechsel
      oder Tab-Wechsel werden revealed Werte aus dem lokalen UI-State verworfen.
- [ ] Fehlerfälle behandeln: RBAC verbietet Secret-Lesen, Secret/Key fehlt,
      Binary/nicht-UTF8-Wert — jeweils mit sicherem, nicht-leakendem Hinweis.

### N3 — Frontend: Environment Variables Tab im Pod-Drawer
Abhängig von: N1, N2.
- [ ] Pod-Detail-Drawer um Tab **Environment Variables** ergänzen (nur für Pods), neben
      Overview/YAML/Events/Metrics/Logs/Terminal; lazy laden wie die anderen Tabs.
- [ ] Darstellung gruppiert nach Container-Typ und Container-Name; innerhalb der Gruppe
      tabellarisch mit Name, Value, Source, Reference/Key und Status.
- [ ] Werte lesbar darstellen: lange Werte einkürzen mit Expand/Copy, Multiline-Werte
      sicher anzeigen, Copy-Button pro Wert/Name; Secret-Copy erst nach Reveal oder mit
      separater bewusster Aktion.
- [ ] Warnungen für nicht auflösbare Quellen gesammelt oberhalb oder innerhalb der
      betroffenen Container-Gruppe anzeigen.

### N4 — Fuzzy Search & Filter UX
Abhängig von: N3.
- [ ] Suchfeld im Tab ergänzen; fuzzy search über Env-Name, Wert (nur wenn nicht secret
      oder bereits revealed), Container-Name, Source-Typ, ConfigMap-/Secret-Name und Key.
- [ ] Treffer hervorheben und leere Container-Gruppen während der Suche ausblenden;
      Clear-Button und Trefferzähler anzeigen.
- [ ] Filter-Chips optional ergänzen: Container, Source-Typ, „Secrets only",
      „Warnings only".
- [ ] Fuzzy-Implementierung leichtgewichtig halten: vorhandene Hilfsfunktion oder kleine
      lokale Scoring-Funktion; keine schwere Such-Library einführen, sofern nicht schon
      vorhanden.

### N5 — Sicherheit, i18n & Tests
Abhängig von: N1–N4.
- [ ] Sicherheitsprüfung: Secret-Werte nie in `settings.json`, localStorage,
      Fehlermeldungen, Console-Logs oder Test-Snapshots persistieren.
- [ ] i18n für neue Tab-Labels, Buttons, Tooltips, Empty States, Warnungen und
      Reveal/Hide-Aktionen in EN/DE ergänzen.
- [ ] Unit-Tests für Env-Auflösung: direkte `env`, ConfigMapKeyRef, SecretKeyRef,
      envFrom mit Prefix, optional/missing Quellen, fieldRef/resourceFieldRef,
      Init-/Ephemeral-Container.
- [ ] UI-/Komponententests für Maskierung, Reveal/Hide, Suche/Fuzzy-Treffer,
      Gruppierung, Copy-Verhalten und Warnungsanzeige.
- [ ] Manuelle Verifikation gegen Pods mit Literals, ConfigMaps, Secrets, envFrom,
      Downward API und fehlenden/optional referenzierten Quellen; RBAC-Fall ohne
      Secret-Leserechte prüfen.

---

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
| 2026-07-08 | Terminal-Panel (I): Kontext-Pinning über temporäre geflattete kubeconfig + `KUBECONFIG`-Env pro Terminal — NIEMALS `kubectl config use-context` gegen die globale ~/.kube/config (würde fremde Shells/Terminals umstellen). Terminals bleiben beim App-Kontextwechsel offen und behalten ihren Kontext (Badge im Tab). |
| 2026-07-08 | Charts (J): leichtgewichtiger SVG-Ansatz bleibt (kein Chart-Bundle) — Achsen/Ticks werden in `SimpleTimeSeriesChart.tsx` ergänzt statt eine Chart-Lib einzuführen. |
| 2026-07-08 | CRD-Gruppierung (K): Default-Mappings aus A1 bleiben Fallback, User-Regeln in Settings haben Vorrang. Custom Icons müssen sicher gerendert werden; keine Skripte/Event-Handler/externen Referenzen in SVGs. |
| 2026-07-08 | Tabellen (L): Spaltenreihenfolge wird pro Kontext/Ressource persistiert und mit Server-Side-Table-Spalten gemergt, damit CRD-`additionalPrinterColumns` erhalten bleiben. Requests/Limits bei Workloads bedeuten PodTemplate-Werte pro Pod, nicht automatisch Replica-hochgerechnete Summen. |
| 2026-07-08 | Flux-Fehlerübersicht (M): Failed/NotReady bekommt eine zentrale Dashboard-Ansicht mit Row-Headern pro Flux-Kind/Kategorie. Suspended wird sichtbar gemacht, aber nicht automatisch als Fehler gezählt. |
| 2026-07-08 | Pod Environment Variables (N): Secret-Werte werden im neuen Pod-Tab standardmäßig maskiert und nur nach explizitem Klick revealed. Revealed Secrets dürfen nicht persistiert oder geloggt werden; fuzzy search darf Secret-Werte erst nach Reveal durchsuchen. |
