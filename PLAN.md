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

**Restpunkte-Runde (2026-07-09):** Offene/optionale Punkte aus C/G/H/J/K/L/M/N
abgearbeitet (C3-Inline-Aktionen, H2-Intl, J3-Chart-Hover, M4-Schnellfilter,
L5-Workload-Requests, N-Restarbeiten, Unit-Test-Grundstock Go + vitest — Details
an den Checkboxen). Bewusst offen bleiben: B2-Port-Forward und C5-Graph (eigene
Arbeitspakete), G3-Signing (kein Apple-Account), UI-/Komponententests (kein
jsdom-Setup eingeführt) und alle manuellen Live-Cluster-Verifikationen.

**Neu geplant (2026-07-09): O–S, empfohlene Reihenfolge O → P → Q → R → S.**
- **O (Light/Dark Mode)** zuerst: alle danach gebauten UI-Teile entstehen direkt
  theme-fähig.
- **P (Rollout-Restart & Scale)** ist unabhängig, aber harte Voraussetzung für R
  (das Popup muss Restart/Scale abfangen).
- **Q (Flux Suspended Übersicht)** ist unabhängig (nutzt nur M-Muster) und liefert
  die Ansicht, auf die R nach einem Suspend verweist.
- **R (Flux-Suspend-Popup)** hängt von P (Aktions-Hook), E2 (Apply-Flow) und C1
  (`SetSuspend`) ab; weiche Abhängigkeit zu Q (Verweis im Erfolgshinweis).
- **S (Server-Mode `--server`)** ist der größte Brocken und berührt die
  Transportschicht aller Features — bewusst zuletzt, damit der Feature-Umfang
  fürs Server-Gating (Terminal, Datei-Dialoge) feststeht. Technisch unabhängig
  von O–R.
- **T (Multiselect & Bulk-Aktionen)** braucht P1 (Bulk-Restart nutzt
  `RolloutRestart`); die Flux-Guard-Integration (T4) hängt weich an R. T ist
  sonst reines Frontend auf bestehenden Bindings und kann jederzeit nach P
  gezogen werden — auch parallel zu Q/R/S.
- **U (Flux Dependency-Graph, aus C5)** ist von O–T unabhängig und baut nur auf
  den bestehenden Flux-Helfern (C2) und dem Test-Setup aus der Restpunkte-Runde
  auf. Einzige weiche Kopplung: nach O sollten die Graph-Farben direkt
  theme-fähig gebaut werden. Kann jederzeit parallel gezogen werden.
- **V (Helm Dashboard & Outdated-Check)** ist von O–U unabhängig (eigener
  Backend-Pfad über Helm-Storage-Secrets, eigenes Dashboard nach C2-Muster).
  Weiche Kopplungen: der lokale `repositories.yaml`-Pfad (V3) ist desktop-only
  und muss im Server-Mode (S) über die Capabilities gegated werden; nach O
  direkt theme-fähig bauen. V1+V2 (Dashboard ohne Outdated-Check) sind allein
  schon lieferbar — V3/V4 danach inkrementell.

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
- [x] Zeilen-Inline-Aktionen (Schnellzugriff ohne Drawer öffnen): Reconcile +
      Suspend/Resume als ActionIcons je Zeile für `*.fluxcd.io`-GVRs. Der
      Suspend-Zustand ist aus der Table-Zeile nicht ablesbar, daher Suspend und
      Resume als getrennte idempotente Aktionen. → `components/flux/FluxRowActions.tsx`,
      als ExtraTableColumn in App.tsx eingehängt. (2026-07-09)

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
- [x] Fast-Polling mit observedGeneration-Fortschritt — **entfällt (2026-07-09):**
      durch die Watch-Streams aus F überholt; das leichte Refetch (400 ms) nach
      Aktionen bleibt als bewusste Lösung.

### C5 — Optional / nachgelagert
- [ ] Dependency-Graph der Kustomizations (`spec.dependsOn`) als Diagramm.
      **→ Als eigener Milestone U geplant (2026-07-09), siehe unten.**

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
      *(Auch 2026-07-09 bewusst offen gelassen: braucht zur Verifikation einen
      Live-Cluster mit RBAC-gesperrtem Proxy — der ursprüngliche Vorbehalt gilt
      weiter; bei Bedarf als eigenes Arbeitspaket mit Cluster-Zugang umsetzen.)*
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
- [x] GitHub-Repo anlegen + README-Badge-Owner (`OWNER`) ersetzen — manueller
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
- [x] `Intl`-Datums-/Zahlenformatierung an Locale koppeln: Charts über J2 erledigt;
      letzte verbliebene Stelle (Events-Timestamp im Drawer, `YamlDrawer.tsx`)
      nutzt jetzt `toLocaleString(i18n.language)`. (2026-07-09)

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
- [x] Crosshair + Tooltip: bei Mausbewegung nächstliegenden Punkt markieren,
      Wert + Zeitpunkt anzeigen (reines SVG/DOM, keine Lib). Umgesetzt in
      `SimpleTimeSeriesChart.tsx`: Maus→viewBox-Mapping (inkl. Letterboxing),
      gestrichelte Crosshair-Linie, Punktmarker, Tooltip mit `formatMetricValue`
      + locale-formatierter Zeit; Tooltip flippt am rechten Rand. (2026-07-09)

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
- [x] Alle neuen UI-Strings in EN/DE ergänzen (`src/i18n/gen/forms.ts`,
      18 `forms.crdGroups.*`-Keys symmetrisch in beiden Sprachen verifiziert
      2026-07-09); Default-Regel-Namen bleiben übersetzbar, User-Labels werden
      unverändert angezeigt.
- [x] Reset-Optionen: einzelne Regel löschen (`removeRule` im Modal) und komplette
      CRD-Gruppen-Konfiguration auf App-Defaults zurücksetzen (`resetDefaults`).
- [x] Kantenfälle behandelt: Icon fehlt/ungültig → neutraler Fallback (K2),
      alle Regeln deaktiviert → Default-Regeln greifen, Pattern matcht nichts →
      roher API-Gruppenname, mehrere Regeln matchen → erste gewinnt (per Unit-Test
      abgesichert, K6). *(Nur Performance-Messung bei sehr vielen CRDs steht aus.)*

### K6 — Tests & Verifikation
Abhängig von: K1–K5.
- [x] Unit-Tests für Pattern-Matching (Suffix-/Infix-Wildcards, kein Match der
      nackten Domain durch `*.`-Pattern), Priorität User- vor Default-Regeln,
      Fallback auf API-Gruppennamen, Kollisionssuffixe und Icon-Sanitizing
      (Script/Event-Handler/externe Refs/foreignObject/Größe).
      → `frontend/src/resourceCatalog.test.ts` (vitest, `npm test`). (2026-07-09)
- [ ] UI-/Komponententests für Regel-Editor, Validierungsfehler, Reset und
      Sidebar-Rendering mit Custom Icons. *(Braucht jsdom/testing-library-Setup —
      bewusst nicht in der Restpunkte-Runde eingeführt.)*
- [ ] Manuelle Verifikation gegen einen Cluster mit Flux/Prometheus/Istio- oder
      Dummy-CRDs: Defaults unverändert, neue Custom-Gruppe greift, Icon wird korrekt
      angezeigt, Settings persistieren über App-Neustart. *(Nur vom User mit
      Live-Cluster durchführbar.)*

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
- [x] Optional für Workloads im Drawer: Requests/Limits aus dem PodTemplate werden
      in der **Übersicht** als eigene Karte „Ressourcen" mit Badge „pro Pod-Template"
      angezeigt (`WorkloadOverview.tsx`, `quantitySummary` wird via `OverviewProps`
      durchgereicht) — bewusst nicht im Metrics-Tab, um Template-Werte nicht mit
      Pod-Live-Metriken zu vermischen. (2026-07-09)

### L6 — Tests & Verifikation
Abhängig von: L1–L5.
- [x] Unit-Tests für Spalten-Merge/Reihenfolge, unbekannte (verschwundene) Keys und
      Anhängen neuer Server-Side-Spalten. → `mergeColumnOrder` aus `ResourceTable.tsx`
      exportiert, Tests in `frontend/src/components/tableColumns.test.ts`. (2026-07-09)
- [x] Unit-Tests für Resource-Aggregation inkl. mehrere Container, Init-Container
      (max-Regel in beide Richtungen), fehlende/ungültige Requests/Limits, CPU
      milli/decimal und Memory binary/decimal units. → `quantities_test.go`. (2026-07-09)
- [ ] UI-/Komponententests für Header-Drag-&-Drop, Persistenz, Reset und Rendering der
      Request/Limit-Spalten. *(Braucht jsdom/testing-library-Setup.)*
- [ ] Manuelle Verifikation gegen Workloads mit gepflegten und nicht gepflegten
      Requests/Limits: Pod-Tabelle, Deployment/StatefulSet/DaemonSet/ReplicaSet-
      Tabellen, Metrics-Drawer und App-Neustart-Persistenz. *(Nur vom User mit
      Live-Cluster durchführbar.)*

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
- [x] Optional: Schnellfilter für Namespace und Kind (clearable/searchable Selects,
      Werte aus den geladenen Problemen abgeleitet) zusätzlich zum bestehenden
      Freitext-Filter; alle drei kombinierbar. → `FluxProblemsOverview.tsx`. (2026-07-09)

### M5 — Live-Updates, i18n & Tests
Abhängig von: M1–M4.
- [x] Bestehende Refresh-/Watch-Mechanik nutzen, damit die Fehlerübersicht nach
      Reconcile/Suspend/Resume und Watch-Events aktualisiert wird; kein separater
      aggressiver Polling-Pfad.
- [x] Alle neuen UI-Strings in EN/DE ergänzen (`src/i18n/gen/dashboards.ts` oder
      passendes neues Bundle).
- [~] Unit-Tests für Failed/NotReady-Filterung, Suspended-Semantik, Gruppierung und
      Sortierung. *(Teilweise erledigt 2026-07-09: die Filter-Bausteine
      `readyCondition`/`isReady`/`isSuspended`/`fluxRevision` sind in `flux_test.go`
      getestet; Gruppierung/Sortierung der View stehen aus — brauchen
      Komponententest-Setup.)*
- [ ] UI-/Komponententests für Dashboard-Klick, Empty-State, Row-Header-Gruppen,
      Detail-Drawer-Öffnung und Message-Kürzung. *(Braucht jsdom/testing-library-Setup.)*
- [ ] Manuelle Verifikation gegen Flux-Ressourcen mit Ready=True, Ready=False,
      Reconciling/Unknown und Suspended: Dashboard-Counts stimmen, zentrale Übersicht
      zeigt nur relevante Ressourcen und Gruppen korrekt getrennt. *(Nur vom User
      mit Live-Cluster durchführbar.)*

---

## Milestone N — Pod Environment Variables Tab

**Ziel:** Beim Öffnen eines Pods über die Sidebar/Table View bekommt der Pod-Detail-
Drawer einen zusätzlichen Tab **Environment Variables**. Dort sind alle Environment-
Variablen der Container übersichtlich sichtbar, inklusive Quellen aus `env`,
`envFrom`, ConfigMaps, Secrets und Downward API. Secret-Werte werden standardmäßig
maskiert und erst nach explizitem Klick angezeigt. Eine fuzzy Suche filtert schnell
nach Name, Wert, Container und Quelle.

### N1 — Backend: Environment-Variablen für Pods auflösen
- [x] Neues Binding z. B. `GetPodEnvironment(namespace, podName)` oder Erweiterung der
      Detail-JSON-Schicht definieren, das Pod-Spec und referenzierte ConfigMaps/Secrets
      im selben Namespace ausliest.
- [x] Datenmodell pro Eintrag festlegen: Container/InitContainer/EphemeralContainer,
      Env-Name, Wert bzw. maskierter Secret-Platzhalter, Quelle (`literal`,
      `configMapKeyRef`, `secretKeyRef`, `envFrom configMap`, `envFrom secret`,
      `fieldRef`, `resourceFieldRef`), optional key/name/prefix und Auflösungsstatus.
- [x] `envFrom` vollständig expandieren: ConfigMap-/Secret-Keys mit Prefix anwenden;
      fehlende optionale Quellen nicht als Fehler behandeln, fehlende nicht-optionale
      Quellen als Warnung pro Eintrag/Quelle zurückgeben.
- [x] Secret-Werte nur im Backend laden, wenn sie für Reveal gebraucht werden, oder im
      Response getrennt als sensitive markiert behandeln; keine Secret-Werte in Logs,
      Fehlertexten oder dauerhaftem Frontend-State persistieren.

### N2 — Secret-Reveal-Mechanik
Abhängig von: N1.
- [x] Secret-Einträge standardmäßig maskiert anzeigen (`••••••••`) mit klarem
      Source-Hinweis, Secret-Name und Key.
- [x] Reveal nur per explizitem Klick pro Wert (Eye-Icon je Zeile); kein globales
      automatisches Entmaskieren beim Tab-Öffnen. → `EnvironmentTab.tsx`.
- [x] „Hide again"-Pfad: Eye-Toggle pro Wert + „Alle verbergen"-Button; revealed
      Werte werden bei Pod-Wechsel zurückgesetzt (State-Reset im Effect) und beim
      Drawer-/Tab-Wechsel verworfen (`keepMounted={false}` am Tabs-Container).
- [x] Fehlerfälle behandelt: RBAC-/Fehlerpfad beim Reveal erscheint als dismissbare
      Inline-Alert (ersetzt nicht mehr die ganze View, 2026-07-09); fehlendes
      Secret/fehlender Key liefern klare Backend-Fehler ohne Wert-Leak;
      Binary/nicht-UTF8-Werte werden als base64 zurückgegeben (`isMostlyText`,
      per Unit-Test abgesichert).

### N3 — Frontend: Environment Variables Tab im Pod-Drawer
Abhängig von: N1, N2.
- [x] Pod-Detail-Drawer um Tab **Environment Variables** ergänzt (nur für Pods),
      lazy geladen wie die anderen Tabs. → `YamlDrawer.tsx` (Tab `env`),
      `components/env/EnvironmentTab.tsx`.
- [x] Darstellung gruppiert nach Container-Typ und Container-Name; innerhalb der
      Gruppe tabellarisch mit Name, Value, Source, Reference/Key und Status.
- [x] Werte lesbar: `lineClamp` mit Titel-Tooltip, Copy-Button pro Wert;
      Secret-Copy erst nach Reveal sichtbar.
- [x] Warnungen für nicht auflösbare Quellen gesammelt als Alert oberhalb der
      Gruppen.

### N4 — Fuzzy Search & Filter UX
Abhängig von: N3.
- [x] Suchfeld im Tab; fuzzy search über Env-Name, Wert (Secrets nur wenn
      revealed), Container-Name, Source-Typ, Referenz-Name und Key
      (`scoreEntry`, lokale Scoring-Funktion).
- [x] Treffer-Highlighting (Mantine `Highlight` auf Name + nicht-sensitiven
      Werten), leere Container-Gruppen während der Suche ausgeblendet,
      Clear-Button und Trefferzähler am Suchfeld. (2026-07-09)
- [ ] Filter-Chips optional ergänzen: Container, Source-Typ, „Secrets only",
      „Warnings only". *(Optional offen gelassen — Suche + Zähler decken den
      Hauptbedarf; bei Bedarf kleines Folgepaket.)*
- [x] Fuzzy-Implementierung leichtgewichtig: lokale Scoring-Funktion, keine
      Such-Library.

### N5 — Sicherheit, i18n & Tests
Abhängig von: N1–N4.
- [x] Sicherheitsprüfung (Code-Review 2026-07-09): revealed Secret-Werte leben nur
      im lokalen Komponenten-State (Reset bei Pod-Wechsel, Unmount bei Tab-/
      Drawer-Wechsel); keine Persistenz in settings.json/localStorage, keine
      Console-Logs, Fehlertexte enthalten keine Werte.
- [x] i18n für Tab-Label, Buttons, Tooltips, Empty States, Warnungen und
      Reveal/Hide in EN/DE (`detail.env.*` inkl. neuer Keys für Trefferzähler,
      Clear und Reveal-Fehler).
- [x] Unit-Tests für Env-Auflösung: direkte `env`, ConfigMapKeyRef, SecretKeyRef
      (masked/sensitive/revealable), envFrom mit Prefix, optional/missing Quellen
      (Warnungs-Semantik), fieldRef/resourceFieldRef, Binary-Erkennung.
      → `env_test.go` mit fake dynamic client. (2026-07-09)
- [ ] UI-/Komponententests für Maskierung, Reveal/Hide, Suche/Fuzzy-Treffer,
      Gruppierung, Copy-Verhalten und Warnungsanzeige. *(Braucht
      jsdom/testing-library-Setup.)*
- [ ] Manuelle Verifikation gegen Pods mit Literals, ConfigMaps, Secrets, envFrom,
      Downward API und fehlenden/optional referenzierten Quellen; RBAC-Fall ohne
      Secret-Leserechte prüfen. *(Nur vom User mit Live-Cluster durchführbar.)*

---

## Milestone O — Light Mode / Dark Mode Setting

**Ziel:** Die App unterstützt Hell, Dunkel und „System" als Farbschema, umschaltbar
im Header-Einstellungsmenü. Heute ist Dark hart gesetzt
(`frontend/src/main.tsx`: `<MantineProvider defaultColorScheme="dark">`), mehrere
Komponenten verwenden hartkodierte Dark-Farben. Default bleibt **Dark** — ohne
User-Aktion ändert sich nichts am heutigen Erscheinungsbild.

### O1 — Color-Scheme-Setting & Umschalter
- [ ] `frontend/src/main.tsx`: `localStorageColorSchemeManager({ key: 'kube-lens-color-scheme' })`
      an den `MantineProvider` geben; `defaultColorScheme="dark"` beibehalten.
      Persistenz in localStorage wie beim Sprachumschalter (Entscheidungslog H:
      reine UI-Präferenz, nicht `settings.json`).
- [ ] Umschalter im Header-Einstellungsmenü in `App.tsx` (dasselbe Mantine-`Menu`,
      in dem der Sprachumschalter sitzt): drei Optionen **Hell / Dunkel / System**
      über `useMantineColorScheme().setColorScheme('light'|'dark'|'auto')`,
      aktive Option markieren (Radio/Check-Icon).

### O2 — Hartkodierte Dark-Farben theme-fähig machen
Abhängig von: O1.
- [ ] Audit-Ergebnis (grep nach `dark.`, `--mantine-color-dark`, `#1b2636`):
      `src/style.css`, `components/metrics/SimpleTimeSeriesChart.tsx` (Gridlines
      `--mantine-color-dark-4`), `components/flux/FluxProblemsOverview.tsx`
      (`bg="dark.7"` auf Row-Headern), `components/terminal/TerminalPanel.tsx`,
      `components/detail/YamlCode.tsx`, `components/logs/LogsTab.tsx`.
- [ ] Ersetzen durch schema-neutrale Mantine-Tokens: CSS-`light-dark()` bzw.
      semantische Variablen (`--mantine-color-body`, `--mantine-color-default`,
      `--mantine-color-default-border`, `--mantine-color-dimmed`) oder
      Mantine-Props ohne festes `dark.*`. Nach dem Umbau darf kein sichtbarer
      Unterschied im Dark Mode entstehen (Vorher/Nachher vergleichen).

### O3 — Editor-, Chart-, Log- und Terminal-Themes
Abhängig von: O1.
- [ ] CodeMirror (`components/editor/YamlEditor.tsx`, aktuell dark): Light-Theme
      ergänzen und über `useComputedColorScheme()` umschalten (Editor-Extension
      per `Compartment` rekonfigurieren, kein Remount nötig).
- [ ] `YamlCode.tsx` (Read-Only-Highlighting) analog auf beide Schemata bringen.
- [ ] SVG-Charts (`SimpleTimeSeriesChart.tsx`): Achsen-/Gridline-/Linienfarben aus
      theme-abhängigen Variablen beziehen (siehe dataviz-Grundsatz: in beiden
      Schemata lesbar).
- [ ] **Erlaubte Vereinfachung:** xterm.js-Terminals (`TerminalTab.tsx`,
      `TerminalPanel.tsx`) und der Log-Viewer (`LogsTab.tsx`) dürfen dauerhaft
      dunkel bleiben (übliche Terminal-Konvention). Wenn ja: bewusst so lassen
      und im Entscheidungslog vermerken; wenn nein: xterm-`theme`-Objekte je
      Schema definieren und bei Wechsel via `terminal.options.theme` live setzen.

### O4 — Fenster-Hintergrund, i18n & Verifikation
Abhängig von: O1–O3.
- [ ] `main.go`: `BackgroundColour` (RGBA 27,38,54) ist nur die Farbe vor dem
      ersten Render (Startup-Flash). Bewerten: neutraler Wert oder belassen —
      kurz im Code kommentieren, kein dynamisches Nachziehen nötig.
- [ ] Neue Menü-Strings in EN/DE ergänzen (`src/i18n/gen/shell.ts`).
- [ ] Manuelle Verifikation **aller** Views in beiden Schemata: Sidebar, Tabellen
      (inkl. Metrik-Spalten), Detail-Drawer alle Tabs, Flux-Dashboard + Problems,
      Cluster-Übersicht, alle Modals (KubeConfig, Prometheus, CRD-Gruppen,
      NewResource), Terminal-Panel-Rahmen. Kontrast-Stichprobe im Light Mode
      (dimmed-Texte, Badges).

---

## Milestone P — Rollout-Restart & Scale für Workloads

**Ziel:** Restart- und Scale-Aktionen direkt aus der App: Rollout-Restart für
Deployments/StatefulSets/DaemonSets (kubectl-identisch über Annotation),
„Restart" für Pods (= Delete, Controller erstellt neu) und Scale für
Deployments/StatefulSets. Die Aktions-Ausführung wird so gekapselt, dass
Milestone R dort einen Pre-Hook einhängen kann.

### P1 — Backend: RolloutRestart
- [ ] Neues Binding `RolloutRestart(group, version, resource, namespace, name string) error`
      (neue Datei `rollout.go` + Delegation in `app.go`, Muster wie `patch.go`):
      Merge-Patch über bestehendes `KubeManager.PatchResource` (patch.go:15) mit
      Payload
      `{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"<time.Now().Format(time.RFC3339)>"}}}}}`
      — exakt das Verhalten von `kubectl rollout restart`.
- [ ] Payload via `json.Marshal` bauen (kein Sprintf, Konvention aus C1).
      Gültige Ziele: `apps/v1` deployments, statefulsets, daemonsets —
      ReplicaSets und andere Kinds lehnt das Backend mit klarem englischem
      Fehler ab (H1-Konvention).

### P2 — Backend: Scale
- [ ] `ScaleResource(group, version, resource, namespace, name string, replicas int) error`:
      Merge-Patch `{"spec":{"replicas":<n>}}` über `PatchResource`. Bewusst kein
      separater Scale-Subresource-Client (Entscheidungslog): Patch-RBAC ist für
      die übrigen Aktionen ohnehin nötig, und der Weg funktioniert identisch.
- [ ] Validierung `replicas >= 0`; obere Sanity-Grenze nicht erzwingen.
- [ ] Bindings generieren (`wailsjs`), Fehlertexte englisch.

### P3 — Frontend: Aktionen im Detail-Drawer
Abhängig von: P1, P2. Einbau in `components/YamlDrawer.tsx`, Muster der
Flux-Aktionsleiste (dort ab ca. Zeile 220: Buttons mit `busy`-State + Notifications).
- [ ] **Restart-Button** für Kind ∈ {Deployment, StatefulSet, DaemonSet}
      (Erkennung wie die bestehende Kind-Erkennung im Drawer): Confirm-Popover
      („Rollout-Neustart auslösen?"), dann `RolloutRestart`.
- [ ] **Scale-Button** für Kind ∈ {Deployment, StatefulSet} (DaemonSets sind
      nicht skalierbar): öffnet kleines Popover/Modal mit `NumberInput`;
      Startwert = `spec.replicas` aus `GetResourceJSON` (beim Öffnen des Dialogs
      frisch lesen, nicht cachen). 0 ist erlaubt („scale to zero"), Hinweis-Zeile
      falls `spec.replicas` fehlt (HPA-verwaltet o. ä.).
- [ ] **Pod-Restart**: Button am Pod-Drawer, ruft bestehendes
      `DeleteResource` (app.go:130) nach Confirm. Wenn der Pod **keine**
      `ownerReferences` hat (aus dem Objekt-JSON prüfen): rote Warnung im
      Confirm („Pod wird nicht neu erstellt").
- [ ] Zeilen-Inline-Aktionen ohne Drawer bleiben verschoben (gleiche Entscheidung
      wie C3) — hier nicht bauen.

### P4 — Aktions-Pipeline, Feedback & i18n
Abhängig von: P3.
- [ ] Gemeinsame Ausführungsfunktion im Drawer kapseln (z. B.
      `runWorkloadAction(kind: 'restart'|'scale'|'podDelete', fn)` analog
      `runFlux` in YamlDrawer.tsx): Busy-State, Success-/Error-Notification,
      leichtes Refetch nach Aktion (400 ms, wie bei Flux-Aktionen; Watch aus F1
      übernimmt den Rest). **Wichtig für R:** genau eine Stelle, an der ein
      Pre-Hook (Flux-Ownership-Check) vor die eigentliche Aktion geschaltet
      werden kann.
- [ ] Alle neuen Strings EN/DE (`src/i18n/gen/detail.ts`).

### P5 — Tests & Verifikation
Abhängig von: P1–P4.
- [ ] Unit-Tests (Go) für Patch-Payload-Bau (Restart-Annotation, Scale-Replicas)
      und Kind-Validierung.
- [ ] Manuelle Verifikation gegen einen Cluster: Deployment-Restart rollt Pods,
      StatefulSet/DaemonSet-Restart, Scale hoch/runter/auf 0, Pod-Restart
      (Pod mit Owner verschwindet und kommt neu; Warnpfad bei nacktem Pod).

---

## Milestone Q — Flux Dashboard: Suspended-Resources-View

**Ziel:** Die Suspended-Kachel im Flux-Dashboard wird klickbar und öffnet eine
zentrale Übersicht aller suspendierten Flux-Ressourcen — gleiche Struktur wie die
Failed/NotReady-Übersicht aus M (Row-Header pro Kind, klickbare Zeilen, Filter).

### Q1 — Backend: Suspended-Aggregation
- [ ] `flux.go`: den Collector aus `FluxProblemResources()` (flux.go:106) in eine
      gemeinsame Funktion mit Filter-Prädikat verallgemeinern (ein Listen-Durchlauf,
      zwei dünne Wrapper) und `FluxSuspendedResources() ([]FluxProblemResource, error)`
      ergänzen; Filter = `isSuspended(obj)` (flux.go:60). Rückgabetyp
      `FluxProblemResource` wiederverwenden (enthält bereits kind/group/version/
      resource/namespace/name/status/reason/message/revision/age).
- [ ] Binding in `app_flux.go` + wailsjs-Bindings generieren.
- [ ] Semantik dokumentieren (Kommentar + ggf. UI-Hinweis): eine Ressource kann
      gleichzeitig suspended **und** NotReady sein und erscheint dann in beiden
      Übersichten — das ist gewollt (Entscheidung aus M: Suspended ist kein Fehler).

### Q2 — Frontend: Kachel klickbar + gemeinsame Listen-Komponente
Abhängig von: Q1.
- [ ] `components/flux/FluxProblemsOverview.tsx` zu einer generischen, gruppierten
      Listen-Komponente verallgemeinern (Props: Titel/Untertitel-Keys, Badge-Farbe,
      Empty-State-Keys, Status-Zellen-Renderer). Daraus `FluxProblemsOverview`
      (rot, wie heute) und neu `FluxSuspendedOverview` (gelb, Status-Spalte zeigt
      „Suspended" + ggf. Ready-Zustand) ableiten — **kein** Copy-Paste der View.
- [ ] `components/flux/FluxOverview.tsx`: Suspended-`SummaryTile` (aktuell ohne
      `onClick`, ca. Zeile 199) bekommt `onClick={totals.suspended > 0 ? onOpenSuspended : undefined}`
      und einen neuen Prop `onOpenSuspended`; optional `prominent` in Gelb bei > 0.
- [ ] `App.tsx`: Routing analog `showFluxProblems` (Zeilen ~110–195):
      `showFluxSuspended`-State, Laden über `FluxSuspendedResources`,
      Refresh-Button-Bedingung (~Zeile 587) und `fluxActive` für die Sidebar
      (~Zeile 649) erweitern; Kontext-/Kind-Wechsel schließt die View wie bei M2.

### Q3 — Interaktion
Abhängig von: Q2.
- [ ] Zeilenklick öffnet den bestehenden Detail-Drawer (Mechanik aus M3); dort ist
      der Resume-Button bereits vorhanden (Flux-Aktionen in YamlDrawer.tsx).
- [ ] Nach Resume/Suspend aus dem Drawer die Übersicht refetchen, damit die Zeile
      verschwindet bzw. erscheint (gleicher Refresh-Pfad wie M5).

### Q4 — i18n & Tests
Abhängig von: Q2, Q3.
- [ ] Strings EN/DE in `src/i18n/gen/dashboards.ts` (`dash.flux.suspended.*`:
      Titel, Untertitel, Empty-State „Nichts suspendiert", Spalten).
- [ ] Unit-Test für die Suspended-Filterung (inkl. Ressource ohne `spec.suspend`).
- [ ] Manuelle Verifikation: Kustomization + HelmRelease suspenden → Kachel-Count
      stimmt, View gruppiert korrekt, Resume aus dem Drawer entfernt die Zeile,
      Empty-State erscheint.

---

## Milestone R — Suspend-Popup bei manuellen Änderungen an Flux-verwalteten Ressourcen

**Ziel:** Wer eine Flux-verwaltete Ressource manuell ändert (YAML-Apply, Rollout-
Restart, Scale), bekommt ein Popup mit dem Hinweis, dass Flux die Änderung beim
nächsten Reconcile überschreiben kann — mit der Option, den verwaltenden Owner
(Kustomization/HelmRelease) direkt zu suspenden.

### R1 — Backend: Flux-Ownership auflösen
Abhängig von: C1 (`SetSuspend`), C2 (`resolveFluxGVR`).
- [ ] Neues Binding `GetFluxOwnership(group, version, resource, namespace, name string) (FluxOwnership, error)`
      in `flux.go` (+ `app_flux.go`): liest das Objekt über den dynamischen Client
      und prüft die Standard-Labels der Flux-Controller:
      - `kustomize.toolkit.fluxcd.io/name` + `kustomize.toolkit.fluxcd.io/namespace`
        → Owner ist eine **Kustomization**
      - `helm.toolkit.fluxcd.io/name` + `helm.toolkit.fluxcd.io/namespace`
        → Owner ist ein **HelmRelease**
      Sind beide Label-Paare vorhanden, gewinnt HelmRelease (direkterer Owner).
- [ ] Rückgabetyp:
      ```go
      type FluxOwnership struct {
          Managed        bool   // eines der Label-Paare vorhanden
          OwnerKind      string // "Kustomization" | "HelmRelease"
          OwnerName      string
          OwnerNamespace string
          OwnerFound     bool   // Owner-Objekt lesbar
          OwnerSuspended bool   // spec.suspend am Owner (isSuspended, flux.go:60)
          // GVR des Owners für den anschließenden SetSuspend-Call:
          OwnerGroup, OwnerVersion, OwnerResource string
      }
      ```
      Owner-GVR über `resolveFluxGVR` (flux.go:209) auflösen. Fehler beim
      Owner-Lesen (RBAC, gelöscht) → `Managed=true, OwnerFound=false`, **kein**
      Error-Return; Fehler nur bei nicht lesbarem Zielobjekt selbst.

### R2 — Frontend: Guard vor mutierenden Aktionen
Abhängig von: R1, P4 (Aktions-Pipeline), E2 (Apply-Flow).
- [ ] Gemeinsame Guard-Funktion (z. B. `components/flux/useFluxSuspendGuard.ts`):
      `confirmFluxSuspendIfManaged(ref, proceed)` — ruft `GetFluxOwnership`
      (Ergebnis pro Drawer-Objekt cachen, bei Objektwechsel invalidieren) und
      entscheidet:
      - nicht managed → `proceed()` direkt;
      - managed + Owner bereits suspended → `proceed()` direkt (kein Popup);
      - managed + Owner aktiv → Modal öffnen.
- [ ] Einhängen an genau drei Stellen:
      1. `components/editor/YamlEditor.tsx`: vor dem **echten** Apply
         (`ApplyResourceYAML(text, false, …)`) — Dry-Run bleibt ungeguarded;
      2. Rollout-Restart und 3. Scale über den P4-Pre-Hook in `YamlDrawer.tsx`.
      Pod-Delete bewusst **nicht** guarden (Pods tragen die Labels i. d. R.
      nicht und ein Pod-Delete konkurriert nicht mit dem Reconcile).
- [ ] Modal-Inhalt: „`<Kind>/<Name>` wird von Flux verwaltet
      (`<OwnerKind> <ownerNs>/<ownerName>`). Flux kann die manuelle Änderung beim
      nächsten Reconcile überschreiben." Drei Buttons:
      **„Suspenden & fortfahren"** (SetSuspend auf den Owner mit den GVR-Feldern
      aus R1, danach Aktion), **„Ohne Suspend fortfahren"**, **„Abbrechen"**.
      Bei `OwnerFound=false`: Hinweis-Variante ohne Suspend-Button
      („Owner nicht lesbar — Änderung kann überschrieben werden").

### R3 — Nacharbeit & Sichtbarkeit
Abhängig von: R2; weich abhängig von Q.
- [ ] Nach „Suspenden & fortfahren": Success-Notification mit dem klaren Hinweis,
      dass `<OwnerKind> <name>` suspendiert **bleibt**, inkl. Verweis auf die
      Suspended-Übersicht (Q) für den späteren Resume. Kein automatisches
      Re-Resume — der User entscheidet, wann Reconcile wieder aktiv wird
      (Entscheidungslog).
- [ ] Suspend-Fehler (RBAC) → Aktion abbrechen und Fehler zeigen, nicht „halb"
      fortfahren.

### R4 — Kanten, i18n & Tests
Abhängig von: R1–R3.
- [ ] Kanten: Owner in anderem Namespace (Label-`namespace` maßgeblich);
      verschachtelte Ownership (HelmRelease selbst von Kustomization verwaltet):
      nur den **direkten** Owner suspenden; Flux-Ressourcen selbst durchlaufen
      denselben Guard (z. B. manuell editierter HelmRelease mit Kustomize-Labels).
- [ ] i18n EN/DE für Modal, Buttons, Notifications (`src/i18n/gen/detail.ts`
      oder `forms.ts`).
- [ ] Go-Unit-Tests für Label-Parsing/Owner-Präferenz/OwnerFound-Fälle;
      UI-Tests für die drei Modal-Pfade und den Cache-Reset bei Objektwechsel.
- [ ] Manuelle Verifikation: kustomize-verwaltetes Deployment scalen → Popup,
      „Suspenden & fortfahren" setzt `spec.suspend: true` an der Kustomization
      und führt den Scale aus; helm-verwaltetes Objekt analog; nicht verwaltetes
      Objekt → kein Popup.

---

## Milestone S — Server-Mode: `--server` für Backend + Frontend im Container

**Ziel:** Die App kann statt als natives Wails-Fenster auch als Webserver laufen
(`kube-lens --server`): Go-Backend + gebautes Frontend in einem Container, Zugriff
per Browser. Der Desktop-Modus bleibt der Default und unverändert. Kernproblem:
Die generierten wailsjs-Bindings rufen `window.go.main.App.<Method>` und
`window.runtime.EventsOn/...` — im Browser existiert beides nicht. Lösung ist eine
HTTP/WebSocket-Bridge im Backend plus ein Frontend-Shim, der genau diese globalen
Objekte nachbildet; die generierten Bindings bleiben unangetastet.

### S1 — CLI-Flags & Betriebsmodi
- [ ] `main.go`: Flag-Parsing (stdlib `flag`): `--server` (bool), `--addr`
      (Default `127.0.0.1:8399`), `--auth-token` (alternativ env
      `KUBE_LENS_AUTH_TOKEN`), `--enable-local-terminal` (bool, Default false).
      Ohne `--server` läuft exakt der heutige `wails.Run`-Pfad.
- [ ] Code-Aufteilung für den Container-Build ohne GTK/WebKit-Linkabhängigkeit:
      `main_desktop.go` (`//go:build !server`, enthält `wails.Run`) und
      `main_server.go`; das normale Binary beherrscht beide Modi, ein Build mit
      `-tags server` erzeugt ein reines Server-Binary ohne Wails-Desktop-Teil
      (für den Linux-Container). Das `embed.FS` mit `frontend/dist` (main.go:14)
      wird von beiden Pfaden genutzt.

### S2 — Event-Emitter-Abstraktion im Backend
- [ ] Alle Aufrufe von `runtime.EventsEmit(a.ctx, event, data)` (in
      `app_logs.go`, `app_exec.go`, `app_terminal.go`, `watch.go`) auf eine
      App-Methode `a.emit(event string, data ...interface{})` umstellen.
      Desktop-Implementierung delegiert an die Wails-Runtime; Server-
      Implementierung broadcastet an alle verbundenen WebSocket-Clients.
      Das ist der einzige invasive Refactor — vorab als eigener Commit, Desktop-
      Verhalten muss dabei identisch bleiben.

### S3 — HTTP/WS-Bridge
Abhängig von: S1, S2.
- [ ] Neue Datei `server.go`: HTTP-Server mit
      - statischem Serving des embedded `frontend/dist` (SPA-Fallback auf
        `index.html`),
      - `POST /api/call` mit Body `{"method": "<Name>", "args": [...]}` →
        Dispatch per Reflection über dieselbe App-Instanz, die auch Wails bindet
        (Methodenliste = exportierte Methoden von `*App`); Args/Returns als JSON
        kompatibel zu den generierten `wailsjs/go/models.ts`-Typen; Fehler als
        `{"error": "<msg>"}` mit HTTP 500,
      - `GET /api/events` als WebSocket: Server→Client-Frames `{event, data}`
        (gespeist aus S2-Broadcast),
      - `GET /healthz` für Container-Probes.
- [ ] WebSocket-Lib festlegen (z. B. `coder/websocket` — klein, kein cgo);
      Client-Registry mit sauberem Cleanup bei Disconnect.

### S4 — Frontend: Runtime-Shim
Abhängig von: S3.
- [ ] Neues Modul `frontend/src/serverBridge.ts`, importiert in `main.tsx` **vor**
      `./App`: Wenn kein Wails-Webview erkannt wird (`window.go` undefined),
      definieren:
      - `window.go.main.App` als `Proxy`, der jeden Methodenaufruf in
        `fetch('/api/call', {method: 'POST', body: JSON.stringify({method, args})})`
        übersetzt (Promise-Rückgabe wie die echten Bindings),
      - `window.runtime` mit `EventsOn/EventsOnce/EventsOff` auf Basis einer
        WebSocket-Verbindung zu `/api/events`, inkl. Reconnect mit Backoff und
        Re-Subscription.
      Die generierten Dateien unter `frontend/wailsjs/` werden **nicht** verändert.
- [ ] Auth-Token (falls gesetzt): einmalige Eingabe im Browser (einfacher
      Login-Prompt), Ablage in `sessionStorage`, als `Authorization: Bearer`-Header
      bzw. WS-Query-Param mitsenden.

### S5 — Feature-Gating & Sicherheit im Server-Mode
Abhängig von: S3, S4.
- [ ] Neues Binding `GetCapabilities() Capabilities` mit
      `{ mode: "desktop"|"server", fileDialogs: bool, localTerminal: bool }`;
      Frontend fragt es beim Start ab und blendet ab:
      - `AddKubeConfigDialog` (nativer Dateidialog, app.go:31) → im Server-Mode
        ausgeblendet; Kubeconfigs kommen aus gemounteter Datei bzw.
        `KUBECONFIG`-Env,
      - Terminal-Panel (Milestone I) → öffnet eine Shell **im Container**, daher
        im Server-Mode standardmäßig deaktiviert, nur mit
        `--enable-local-terminal` sichtbar. Pod-Exec (D3) bleibt erlaubt.
- [ ] Auth-Middleware auf `/api/*`: ohne konfigurierten Token nur Bind auf
      Loopback erlauben und beim Start deutlich warnen, wenn `--addr` nicht
      loopback ist; mit Token Bearer-Check (constant-time compare). TLS bewusst
      extern (Reverse-Proxy) — in README dokumentieren, inkl. klarer Warnung:
      der Server exponiert die vollen Cluster-Rechte der gemounteten Kubeconfig.
- [ ] Settings-Verzeichnis (`os.UserConfigDir()/kube-lens/`) im Container über
      env `KUBE_LENS_CONFIG_DIR` überschreibbar machen; Volume in der Doku.

### S6 — Container-Build & CI
Abhängig von: S1–S5.
- [ ] `Dockerfile` (multi-stage): Node 20 → `npm ci && npm run build` in
      `frontend/`; Go 1.26 → `go build -tags server`; Runtime-Stage schlank
      (distroless/base oder alpine), non-root User, `EXPOSE 8399`,
      `ENTRYPOINT ["kube-lens", "--server", "--addr", "0.0.0.0:8399"]`.
- [ ] README-Abschnitt „Server mode": docker-run-Beispiel mit
      `-v ~/.kube/config:/home/nonroot/.kube/config:ro`, Token-Env, Hinweis auf
      exec-Auth-Plugins (kubelogin etc. sind im Container **nicht** vorhanden —
      Kubeconfigs mit exec-Auth funktionieren nur, wenn das Plugin ins Image
      gelegt wird; als bekannte Einschränkung dokumentieren).
- [ ] Optional: Image-Build-Job in `.github/workflows/build.yml` (nur Build,
      kein Registry-Push ohne Secrets).
- [ ] Nachgelagert (eigener Punkt, nicht in S umsetzen): In-Cluster-Config
      (`rest.InClusterConfig`) als zusätzliche Kontext-Quelle, damit kube-lens
      als In-Cluster-Deployment ohne Kubeconfig laufen kann.

### S7 — Verifikation
Abhängig von: S1–S6.
- [ ] Desktop-Regression: `wails build` + App-Start unverändert (Events, Logs,
      Terminal, Dialoge).
- [ ] Server lokal: `go run -tags server . --server` mit lokaler Kubeconfig;
      Browser-Test der Kernflüsse: Kontexte/Namespaces, Tabellen inkl. Watch-
      Refresh, Detail-Drawer alle Tabs, Log-Streaming (WS), Pod-Exec-Terminal,
      Flux-Dashboard inkl. Aktionen, YAML-Apply.
- [ ] Container: `docker build` + `docker run` mit gemounteter Kubeconfig gegen
      einen Cluster ohne exec-Auth; Gating sichtbar (kein Datei-Dialog, kein
      lokales Terminal), `/healthz` ok, Auth-Token erzwungen bei non-loopback.

---

## Milestone T — Multiselect & Bulk-Aktionen in der Table View

**Ziel:** In der Ressourcen-Tabelle lassen sich mehrere Ressourcen desselben Typs
per Checkbox auswählen und gemeinsam bearbeiten — zunächst **Delete** (alle Kinds)
und **Rollout-Restart** (Deployments/StatefulSets/DaemonSets). Es gibt keine
neuen Backend-Bindings: das Frontend iteriert über die bestehenden
Einzel-Bindings (`DeleteResource`, app.go:130; `RolloutRestart` aus P1) und
sammelt Ergebnisse pro Ressource ein.

### T1 — Selection-State & Checkbox-Spalte
Grundlage: `components/ResourceTable.tsx` (Rows = `TableRow { name, namespace, cells }`
aus `types.ts:31`, Klick-Handler `onRowClick` öffnet den Drawer).
- [ ] Checkbox-Spalte als **erste** Spalte ergänzen: Header-Checkbox
      (Alle sichtbaren/gefilterten Zeilen an/abwählen, indeterminate-Zustand bei
      Teilauswahl), Zeilen-Checkbox mit `event.stopPropagation()` — Zeilenklick
      außerhalb der Checkbox öffnet weiterhin den Drawer.
- [ ] Selection-Key = `${namespace}/${name}` (innerhalb einer Table View ist die
      GVR fix, das ist eindeutig; bei cluster-scoped Ressourcen ist `namespace`
      leer — Key funktioniert trotzdem). Shift-Klick wählt den Bereich seit dem
      letzten angeklickten Eintrag.
- [ ] Selection-State lebt in `App.tsx` neben dem Tabellen-State und wird
      **zurückgesetzt** bei: Ressourcen-/Kontext-/Namespace-Wechsel und
      Filteränderung nur optional (Auswahl gefilterter, unsichtbarer Zeilen
      bleibt bestehen, Zähler zeigt Gesamtauswahl).
- [ ] Refresh-Verträglichkeit: nach jedem Tabellen-Reload (Watch/Poll aus F)
      Selection gegen die neuen Rows prunen — verschwundene Ressourcen fliegen
      aus der Auswahl.
- [ ] Wechselwirkung mit L2 (Spalten-Drag-&-Drop): Checkbox-Spalte ist wie die
      Actions-Spalte von Reihenfolge/Drag ausgenommen und taucht nicht in
      `columnOrder`/`hiddenColumns` auf.

### T2 — Bulk-Action-Bar
Abhängig von: T1.
- [ ] Sticky Aktionsleiste ober- oder unterhalb der Tabelle, sichtbar sobald
      Auswahl > 0: Zähler („7 ausgewählt"), Button **Auswahl aufheben**, dann die
      Aktionen:
      - **Löschen** — immer verfügbar.
      - **Restart** — nur wenn die aktuelle GVR ∈ {apps/v1 deployments,
        statefulsets, daemonsets} (dieselbe Kind-Erkennung wie P3);
        nutzt `RolloutRestart` aus P1.
      - Optional (nur wenn trivial, sonst eigener späterer Punkt): für
        `*.fluxcd.io`-Kinds zusätzlich **Reconcile** und **Suspend/Resume**
        über die bestehenden Flux-Bindings.
- [ ] Confirm-Modal vor jeder Bulk-Aktion: Aktionsname + Liste der betroffenen
      Ressourcen (`namespace/name`, scrollbar bei vielen), Bestätigungs-Button
      mit Count im Label („7 Ressourcen löschen"). Kein Confirm-Skip — Bulk-Delete
      ist destruktiv.

### T3 — Ausführung, Fortschritt & Ergebnis
Abhängig von: T2. Bewusst **kein** neues Batch-Binding im Backend
(Entscheidungslog): Fehlergranularität pro Ressource, kein neuer API-Pfad.
- [ ] Ausführungsschleife im Frontend: begrenzte Parallelität (z. B. 4 gleichzeitig),
      pro Eintrag Einzel-Binding aufrufen, Ergebnis (`ok` | Fehlertext) sammeln.
      Während des Laufs: Aktionsleiste zeigt Fortschritt („3/7 …"), Aktionen und
      Checkboxen disabled, kein Abbruch-Button nötig (Läufe sind kurz), aber
      bereits abgesetzte Calls laufen bei Drawer-/View-Wechsel zu Ende.
- [ ] Ergebnis-Notification: „5 gelöscht, 2 fehlgeschlagen" mit aufklappbarer
      Fehlerliste (Ressource + englische Backend-Fehlermeldung). Erfolgreiche
      Einträge werden aus der Selection entfernt, fehlgeschlagene bleiben
      ausgewählt (erleichtert Retry).
- [ ] Nach Abschluss leichtes Refetch (400 ms, Muster aus C4/P4); Watch aus F1
      übernimmt Folgeänderungen.

### T4 — Flux-Guard für Bulk-Aktionen
Abhängig von: R (weich — ohne R entfällt dieser Punkt ersatzlos, T bleibt lauffähig).
- [ ] Vor Bulk-Delete/-Restart `GetFluxOwnership` (R1) für die ausgewählten
      Ressourcen abfragen (sequenziell mit kleinem Limit oder parallel ≤ 4;
      bei > ~30 Auswahl-Einträgen Abfrage überspringen und stattdessen
      generischen Hinweis zeigen — kein Request-Sturm).
- [ ] Statt N Einzel-Popups **ein** Sammel-Modal: distinct Owner auflisten
      („verwaltet von Kustomization a/b, HelmRelease c/d …"), Optionen
      **„Alle Owner suspenden & fortfahren" / „Ohne Suspend fortfahren" /
      „Abbrechen"** — Wiederaufnahme wie bei R über die Suspended-Übersicht (Q).
- [ ] Bereits suspendierte Owner nicht erneut suspenden; nicht lesbare Owner im
      Modal als Hinweis aufführen (analog R2 `OwnerFound=false`).

### T5 — Kanten, i18n & Tests
Abhängig von: T1–T3.
- [ ] Kanten: Auswahl über „alle Namespaces"-Ansicht (Namespace steht je Zeile
      im Key), cluster-scoped Ressourcen, leere Tabelle nach Bulk-Delete
      (Empty-State statt hängender Aktionsleiste), Header-Checkbox bei aktivem
      Textfilter wählt nur die gefilterten Zeilen.
- [ ] i18n EN/DE für Aktionsleiste, Confirm-Modals, Fortschritt, Ergebnis-
      Notifications (`src/i18n/gen/forms.ts` oder neues Bundle).
- [ ] Komponententests: Selection-Logik (Select-All/indeterminate/Shift-Range/
      Prune nach Reload), Confirm-Liste, Ergebnis-Aggregation mit Teilfehlern.
- [ ] Manuelle Verifikation: 5+ Pods auswählen und löschen (Teilfehler per RBAC
      provozieren, wenn möglich), Deployments bulk-restarten, Auswahl über
      Namespace-Filter, App-Verhalten während laufender Bulk-Aktion.

---

## Milestone U — Flux Dependency-Graph (`spec.dependsOn`)

**Ziel:** Eine Graph-Ansicht im Flux-Bereich, die die `spec.dependsOn`-Beziehungen
zwischen Flux-Ressourcen als gerichteten Graphen (DAG) visualisiert — Reihenfolge
und Blockaden der Reconciliation werden auf einen Blick sichtbar. Scope:
**Kustomizations und HelmReleases** (beide unterstützen `spec.dependsOn` mit
identischer Semantik: Liste von `{name, namespace?}`-Referenzen auf Ressourcen
**derselben Kind**; fehlender `namespace` = eigener Namespace der Ressource).
Status (Ready/NotReady/Suspended) wird auf den Knoten angezeigt, Klick öffnet den
bestehenden Detail-Drawer. Rendering als leichtgewichtiges SVG mit eigenem
Layered-Layout — **keine Graph-Library** (dependsOn-Graphen sind klein, typisch
< 50 Knoten; Entscheidungslog).

### U1 — Backend: Graph-Daten aggregieren
Grundlage: bestehende Helfer in `flux.go` (`fluxResources`, `readyCondition`,
`isSuspended`, `fluxRevision`).
- [ ] Neues Binding `FluxDependencyGraph() (FluxDependencyGraph, error)` in
      `flux.go` + Delegation in `app_flux.go`; wailsjs-Bindings generieren.
      Listet clusterweit alle Kustomizations (`kustomize.toolkit.fluxcd.io`) und
      HelmReleases (`helm.toolkit.fluxcd.io`) und baut:
      ```go
      type FluxDependencyNode struct {
          Kind, Namespace, Name          string // Identität
          Group, Version, Resource       string // GVR für Drawer/Aktionen
          Ready, Suspended               bool
          Status, Reason                 string // aus readyCondition
          Revision                       string
      }
      type FluxDependencyEdge struct {
          FromKind, FromNamespace, FromName string // die abhängige Ressource
          ToKind, ToNamespace, ToName       string // das dependsOn-Ziel
          Unresolved                        bool   // Ziel existiert nicht
      }
      type FluxDependencyGraph struct {
          Nodes []FluxDependencyNode
          Edges []FluxDependencyEdge
      }
      ```
- [ ] `spec.dependsOn` je Objekt lesen (`unstructured.NestedSlice`); Einträge sind
      `{name string, namespace string?}` — fehlender Namespace wird mit dem
      Namespace der abhängigen Ressource aufgefüllt. Ziel-Kind = eigene Kind
      (Kustomization→Kustomization, HelmRelease→HelmRelease; Cross-Kind gibt es
      in Flux nicht).
- [ ] Kanten auf nicht existierende Ziele **nicht** verwerfen: `Unresolved=true`
      setzen und einen synthetischen Knoten (nur Kind/Namespace/Name, Status leer)
      aufnehmen — die UI zeigt ihn als „fehlt"-Knoten. Das ist ein realer
      Fehlerzustand (Reconcile hängt an nicht existierender Dependency).
- [ ] Knoten ohne ein- und ausgehende Kanten standardmäßig **mitliefern**
      (Filterung ist UI-Sache, U4); englische Fehlertexte (H1-Konvention).

### U2 — Frontend: Layered-DAG-Layout als pure Funktion
Unabhängig von U1 entwickelbar (arbeitet auf dem U1-Datenmodell).
- [ ] Neues Modul `frontend/src/components/flux/dependencyLayout.ts` — **pure
      Funktion** `layoutDependencyGraph(nodes, edges, opts) → {positionedNodes,
      routedEdges, width, height}`, damit sie ohne DOM unit-testbar ist (vitest,
      Muster aus der Restpunkte-Runde).
- [ ] Algorithmus bewusst simpel (Sugiyama light):
      1. **Ebenen** per Longest-Path-Topologie: Knoten ohne Dependencies auf
         Ebene 0, jeder weitere auf `max(Ebene seiner Dependencies) + 1`.
      2. **Zyklen** dürfen den Layout nicht crashen: Kanten, die einen Zyklus
         schließen, werden für die Ebenenberechnung ignoriert, aber gezeichnet
         und als „cycle" markiert (Flux selbst lehnt Zyklen zur Laufzeit ab —
         die UI muss sie trotzdem anzeigen können, weil sie im Cluster stehen
         können).
      3. **Innerhalb einer Ebene** einfache Kreuzungsminimierung per
         Barycenter-Sortierung (ein Durchlauf reicht bei dieser Graphgröße).
      4. Kanten als kubische Bézier-Pfade zwischen den Ebenen.
- [ ] Getrennte Teilgraphen (Kustomizations vs. HelmReleases bzw. unverbundene
      Inseln) untereinander mit Abstand layouten; deterministische Sortierung
      (Namespace/Name), damit das Layout zwischen Refreshes stabil bleibt.

### U3 — Frontend: Graph-View im Flux-Bereich
Abhängig von: U1, U2.
- [ ] Einstieg im Flux-Dashboard: Button/Kachel „Dependencies" neben dem
      Problems-Einstieg (`FluxOverview.tsx`); Routing in `App.tsx` analog
      `showFluxProblems` (`showFluxDeps`-State, Refresh-Button-Bedingung und
      Sidebar-`fluxActive` erweitern, Kontext-Wechsel schließt die View).
- [ ] Neue Komponente `components/flux/FluxDependencyGraphView.tsx`: SVG-Canvas
      in `ScrollArea` (beide Richtungen), Knoten als Rechtecke mit Kind-Badge,
      `namespace/name`, Status-Punkt; Kanten mit Pfeilspitzen (`<marker>`).
      Farben theme-fähig über Mantine-Variablen (O-Konvention): Ready grün,
      NotReady rot, Suspended gelb, Unresolved/fehlt grau gestrichelt,
      Zyklus-Kanten rot gestrichelt.
- [ ] Zoom pragmatisch halten: Stufen-Zoom (Buttons/Slider, CSS-Transform auf
      der SVG-Gruppe) statt Pan/Zoom-Library; Fit-to-View beim Öffnen.
- [ ] Leerer Zustand: keine Kustomizations/HelmReleases mit `dependsOn` →
      Empty-State mit kurzem Erklärtext (Graph zeigt nur dependsOn-Beziehungen).

### U4 — Interaktion & Filter
Abhängig von: U3.
- [ ] Klick auf Knoten öffnet den bestehenden Detail-Drawer (Mechanik wie
      `onOpenResource` in der Problems-View, M3) — Reconcile/Suspend/Resume sind
      dort verfügbar; nach Drawer-Aktionen Graph refetchen (400-ms-Muster).
- [ ] Hover/Selektion: beim Hovern eines Knotens dessen direkte Vorgänger/
      Nachfolger-Kanten hervorheben, Rest abdunkeln (reines SVG-Klassen-Toggling,
      kein Re-Layout).
- [ ] Filter oberhalb des Graphen: Kind (Kustomization/HelmRelease/beide),
      Namespace (Select, Werte aus den Knoten), Toggle „nur Knoten mit
      Dependencies" (Default: an, blendet isolierte Knoten aus), Toggle „nur
      Probleme" (NotReady/Unresolved + deren direkte Nachbarn).
- [ ] Tooltip je Knoten (Status/Reason/Revision) — Muster aus J3 wiederverwenden
      (SVG-Tooltip, kein Portal nötig).

### U5 — Live-Updates, i18n & Tests
Abhängig von: U1–U4.
- [ ] Refresh über den bestehenden Flux-Refresh-Pfad (Button + nach Aktionen);
      kein eigener Polling-Pfad. Layout-Stabilität beim Refresh prüfen
      (deterministische Sortierung aus U2).
- [ ] Alle neuen Strings EN/DE in `src/i18n/gen/dashboards.ts`
      (`dash.flux.deps.*`: Titel, Filter, Empty-State, Legende, Tooltips).
- [ ] Go-Unit-Tests (`flux_test.go` erweitern oder `flux_deps_test.go`):
      dependsOn-Parsing inkl. Namespace-Defaulting, Unresolved-Ziel erzeugt
      synthetischen Knoten + markierte Kante, HelmRelease- und
      Kustomization-Pfad.
- [ ] Vitest für `dependencyLayout.ts`: Ebenenzuordnung (Kette, Diamant),
      Zyklus bricht Layout nicht und markiert die Kante, deterministische
      Ausgabe bei gleicher Eingabe, getrennte Inseln überlappen nicht.
- [ ] Manuelle Verifikation gegen einen Cluster mit gestaffelten Kustomizations
      (z. B. infra → apps): Reihenfolge stimmt, NotReady-Knoten blockierender
      Dependencies sind rot, Klick öffnet Drawer, Filter wirken. *(Nur vom User
      mit Live-Cluster durchführbar.)*

---

## Milestone V — Helm Dashboard & Outdated-Check

**Ziel:** Ein Helm-Dashboard (Sidebar-„Dashboards"-Sektion, Muster von C2), das
alle Helm-Releases im Cluster listet — unabhängig davon, ob sie per Helm-CLI oder
Flux (helm-controller) installiert wurden — und pro Release anzeigt, ob eine
neuere Chart-Version im Quell-Repo verfügbar ist.

**Machbarkeits-Kern (Entscheidungslog):** Helm 3 speichert Releases als Secrets
vom Typ `helm.sh/release.v1` — Discovery ist zuverlässig und braucht **kein
Helm-SDK**. Aber: Helm speichert im Release **nicht**, aus welchem Repo ein Chart
kam. Die Repo-Zuordnung ist deshalb dreistufig: (1) Flux-Releases → HelmRepository-
CR, zuverlässig und automatisch; (2) Desktop: lokale `repositories.yaml` als
Heuristik über den Chart-Namen; (3) manuelle Overrides in den Settings. Für
Releases ohne zuordenbares Repo zeigt die UI ehrlich „Quelle unbekannt" statt zu
raten. OCI-Registries (kein `index.yaml`) sind bewusst ausgeklammert → Status
„unknown", eigener späterer Punkt.

### V1 — Backend: Release-Discovery über Helm-Storage-Secrets
Kein Helm-SDK als Dependency — der Storage-Layer wird direkt gelesen.
- [ ] Neue Datei `helm.go` + Delegation in neuem `app_helm.go`; Binding
      `HelmReleases() ([]HelmReleaseInfo, error)`:
      Secrets clusterweit listen mit Label-Selector `owner=helm` (Typ
      `helm.sh/release.v1`, Name `sh.helm.release.v1.<release>.v<revision>`).
      Pro `(namespace, release)` nur die **höchste Revision** auswerten.
- [ ] Payload dekodieren: `secret.data.release` ist (nach API-base64) ein
      base64-String; dekodiert beginnt er mit gzip-Magic `0x1f 0x8b` → gunzip →
      JSON. Relevante Felder:
      ```go
      type HelmReleaseInfo struct {
          Name, Namespace   string
          Revision          int
          Status            string // deployed, failed, pending-*, superseded, uninstalling
          ChartName         string // chart.metadata.name
          ChartVersion      string // chart.metadata.version
          AppVersion        string // chart.metadata.appVersion
          Description       string // info.description (letzte Aktion)
          LastDeployed      string // info.last_deployed
          FluxManaged       bool   // Labels helm.toolkit.fluxcd.io/* am Secret
          FluxHelmRelease   string // "<ns>/<name>" wenn FluxManaged
      }
      ```
      **Nicht** dekodieren/ausliefern: `config`/`chart.values` (User-Values können
      Secrets enthalten — fürs Dashboard unnötig, N5-Sicherheitslinie).
- [ ] Fehlertoleranz: einzelne nicht dekodierbare Secrets überspringen und als
      Warnung zählen, nicht den ganzen Call fehlschlagen lassen. Timeout wie bei
      `FluxStatus` (20 s), englische Fehler.
- [ ] Optional (nur wenn trivial): ConfigMap-Driver (`HELM_DRIVER=configmap`)
      analog lesen; sonst als bekannte Einschränkung dokumentieren (Secrets sind
      der Default und der Flux-Weg).
- [ ] `helmAvailable`-Signal fürs Frontend: Dashboard-Eintrag nur zeigen, wenn
      mindestens ein Release-Secret existiert (Muster `fluxAvailable`, C2) —
      als eigenes leichtes Binding oder als leeres-Array-Konvention.

### V2 — Frontend: Helm-Dashboard
Abhängig von: V1.
- [ ] Sidebar-„Dashboards"-Sektion um **Helm** erweitern (neben Cluster/Flux);
      Routing in `App.tsx` analog `showFlux` (`showHelm`-State, Refresh-Button,
      Kontext-Wechsel schließt die View).
- [ ] Neue Komponenten `components/helm/HelmOverview.tsx` (+ `types.ts`, `index.ts`):
      Summary-Kacheln oben (Total / Deployed / Failed+Pending / Outdated — letzte
      erst mit V4 gefüllt, vorher ausgeblendet), darunter Tabelle:
      Namespace, Release, Chart, installierte Version, App-Version, Status-Badge,
      Letztes Deploy (locale-formatiert), Flux-Badge wenn `FluxManaged`,
      ab V4 zusätzlich „Neueste Version" + Outdated-Badge.
- [ ] Filter wie in der Flux-Problems-View (M4-Muster): Freitext + Namespace- und
      Status-Select; Sortierung Namespace/Name, Failed zuerst optional.
- [ ] Zeilenklick: bei `FluxManaged` den bestehenden Detail-Drawer der zugehörigen
      HelmRelease-Ressource öffnen (GVR via `resolveFluxGVR`, Aktionen inklusive);
      sonst kompaktes Info-Panel/Modal mit den V1-Feldern und Revisionshistorie
      (Anzahl Revisionen aus den Secret-Namen). **Keine** Helm-Aktionen
      (Rollback/Uninstall) in diesem Milestone — falls gewünscht, eigener
      späterer Punkt mit eigener Risikobetrachtung.
- [ ] Empty-State („keine Helm-Releases gefunden") und Warnungs-Anzeige für
      übersprungene Secrets aus V1.

### V3 — Repo-Zuordnung (dreistufig)
Abhängig von: V1. Ergebnis pro Release: `repoURL` + `repoSource`
(`flux | localConfig | manual | none`).
- [ ] **Stufe 1 — Flux (zuverlässig):** für `FluxManaged`-Releases die
      HelmRelease-CR lesen: `spec.chart.spec.sourceRef` → HelmRepository-CR →
      `spec.url` (Chart-Name aus `spec.chart.spec.chart`). `chartRef`
      (OCIRepository/HelmChart) erkennen; OCI → `repoSource=none` mit Grund
      „OCI" (siehe V4). Bestehende Muster aus `extractSourceRef` (flux.go)
      wiederverwenden.
- [ ] **Stufe 2 — lokale Helm-Config (Heuristik, desktop-only):**
      `helm env`-Konvention: `~/Library/Preferences/helm/repositories.yaml`
      (macOS) bzw. `~/.config/helm/repositories.yaml` (Linux) parsen
      (`{repositories: [{name, url}]}`); Zuordnung über Chart-Namen via
      `index.yaml`-Treffer in V4 (das Repo, dessen Index den Chart enthält;
      bei mehreren Treffern: als „mehrdeutig" markieren, nicht raten).
      Im Server-Mode (S) über Capabilities deaktivieren.
- [ ] **Stufe 3 — manuelle Overrides:** Settings-Erweiterung (global, nicht pro
      Kontext — Chart→Repo ist kontextunabhängig):
      ```json
      "helm": { "repoOverrides": { "<chartName>": "https://charts.example.com" } }
      ```
      Editierbar über ein kleines Modal aus dem Helm-Dashboard heraus
      (Settings-Persistenz-Muster aus kube.go). Overrides schlagen Stufe 1+2.
- [ ] Releases ohne Zuordnung: `repoSource=none` — UI zeigt „Quelle unbekannt"
      mit Tooltip, warum (kein Flux, kein lokaler Treffer, OCI, …) und Hinweis
      auf den Override. **Kein** automatischer ArtifactHub-Lookup: externe
      Anfragen mit Chart-Namen nur, wenn überhaupt, als späteres Opt-in
      (Open-Source-/Privacy-Linie, Entscheidungslog).

### V4 — Outdated-Check gegen `index.yaml`
Abhängig von: V3.
- [ ] Backend `HelmCheckUpdates(releases …) ([]HelmUpdateInfo, error)` (oder in
      `HelmReleases` integriert mit `checkUpdates bool`): pro distinct `repoURL`
      **einmal** `GET <repoURL>/index.yaml` laden, YAML parsen
      (`entries: {<chart>: [{version, created, …}]}`), pro Chart die höchste
      **stabile** Semver ermitteln (Prereleases ignorieren, außer die installierte
      Version ist selbst eine Prerelease).
- [ ] Semver-Vergleich über `github.com/Masterminds/semver/v3` (kleine, etablierte
      Lib — kein Hand-Parser); nicht parsebare Versionen → Status `unknown`,
      niemals falsch-positiv „outdated".
- [ ] **Cache zwingend** (index.yaml kann >10 MB sein, z. B. Bitnami): In-Memory
      pro Repo-URL mit TTL ~1 h; expliziter „Nach Updates suchen"-Button im
      Dashboard invalidiert den Cache. Kein automatischer Check bei jedem
      Dashboard-Öffnen — erster Check on-demand oder einmal pro App-Lauf.
      HTTP-Timeout (~15 s) und Größenlimit; Fehler pro Repo isolieren
      (ein totes Repo darf die anderen Ergebnisse nicht blockieren).
- [ ] Ergebnis pro Release: `latestVersion`, `outdated bool`, `checkStatus`
      (`ok | unknown | repoUnreachable | chartNotFound | ambiguous | oci`).
      UI: Outdated-Badge (Farbe orange), Tooltip mit installiert → neueste,
      Summary-Kachel „Outdated" zählt nur `checkStatus=ok && outdated`.
- [ ] OCI-Charts in diesem Milestone **nicht** prüfen (Tag-Listing bräuchte
      Registry-Auth) → `checkStatus=oci`, ehrlich als „nicht prüfbar" angezeigt;
      eigener späterer Punkt.

### V5 — i18n, Sicherheit & Tests
Abhängig von: V1–V4.
- [ ] Alle Strings EN/DE (`src/i18n/gen/dashboards.ts`, `dash.helm.*`).
- [ ] Sicherheitslinie: Release-`config`/Values werden weder dekodiert noch
      geloggt noch ans Frontend gegeben (V1); index.yaml-Requests gehen nur an
      Repo-URLs aus Cluster/lokaler Config/Overrides — keine Drittdienste.
- [ ] Go-Unit-Tests (`helm_test.go`): Storage-Decode (base64+gzip+JSON aus
      Fixture), höchste-Revision-Auswahl, kaputtes Secret wird übersprungen,
      Flux-Label-Erkennung; Outdated-Logik: Semver-Vergleich inkl. Prerelease-
      Regeln, `index.yaml`-Parsing (Fixture), Chart-not-found/ambiguous-Pfade.
- [ ] Vitest für reine Frontend-Helfer (Filter-/Sortierlogik), falls ausgelagert.
- [ ] Manuelle Verifikation: Cluster mit Flux-HelmReleases (Repo automatisch
      erkannt, Outdated korrekt), ein CLI-installiertes Release (lokale
      repositories.yaml greift), ein Release ohne Quelle („unbekannt"),
      Cache-/Refresh-Verhalten. *(Nur vom User mit Live-Cluster durchführbar.)*

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
| 2026-07-09 | Theme (O): Farbschema-Persistenz in localStorage (`kube-lens-color-scheme`, wie Sprache) statt settings.json; Default bleibt Dark. Terminals/Logs dürfen als bewusste Vereinfachung dauerhaft dunkel bleiben. |
| 2026-07-09 | Rollout/Scale (P): Restart über kubectl-identische Annotation `kubectl.kubernetes.io/restartedAt` im PodTemplate; Pod-„Restart" = Delete (Controller erstellt neu, Warnung bei Pods ohne ownerReferences); Scale als Merge-Patch auf `spec.replicas` statt Scale-Subresource-Client. |
| 2026-07-09 | Suspended-Übersicht (Q): teilt sich die Komponentenbasis mit der Problems-Übersicht aus M (eine generische gruppierte Listen-Komponente, kein Duplikat). Suspended+NotReady erscheint bewusst in beiden Ansichten. |
| 2026-07-09 | Flux-Suspend-Popup (R): Ownership über die Controller-Labels `kustomize.toolkit.fluxcd.io/name|namespace` bzw. `helm.toolkit.fluxcd.io/name|namespace`; bei beiden gewinnt HelmRelease (direkterer Owner). Suspend wirkt nur auf den direkten Owner; kein automatisches Resume — Wiederaufnahme über die Suspended-Übersicht (Q). Guard greift bei Apply/Restart/Scale, nicht bei Pod-Delete. |
| 2026-07-09 | Server-Mode (S): kein Fork der generierten wailsjs-Bindings — Backend-HTTP/WS-Bridge (`POST /api/call` + `/api/events`) plus Frontend-Shim, der `window.go`/`window.runtime` im Browser nachbildet. Events laufen über eine `a.emit`-Abstraktion statt direkter `runtime.EventsEmit`-Calls. Lokales Terminal-Panel ist im Server-Mode standardmäßig deaktiviert (Shell im Container), Auth per Bearer-Token, TLS extern via Reverse-Proxy. |
| 2026-07-09 | Restpunkte-Runde: Test-Grundstock eingeführt — Go-Unit-Tests (`quantities_test.go`, `flux_test.go`, `env_test.go` mit fake dynamic client) und vitest fürs Frontend (`npm test`; nur pure Funktionen, kein jsdom/testing-library). C4-Fast-Polling entfällt endgültig (durch Watch aus F ersetzt). C3-Inline-Aktionen: Suspend/Resume als getrennte idempotente Aktionen, da der Suspend-Zustand aus der Server-Side-Table-Zeile nicht ablesbar ist. |
| 2026-07-09 | Dependency-Graph (U, aus C5): Scope = Kustomizations **und** HelmReleases (`spec.dependsOn`, gleiche Semantik, Ziel immer dieselbe Kind; fehlender Namespace = eigener). Keine Graph-/Pan-Zoom-Library — eigenes Layered-Layout als pure, unit-testbare Funktion + SVG (Graphen sind klein, konsistent mit der No-Chart-Bundle-Linie aus J). Unresolved-Ziele werden als synthetische „fehlt"-Knoten gezeigt, Zyklen dürfen das Layout nicht crashen. |
| 2026-07-09 | Helm Dashboard (V): Release-Discovery direkt über Helm-Storage-Secrets (`helm.sh/release.v1`, base64+gzip+JSON) — **kein Helm-SDK** als Dependency. Release-Values werden nie dekodiert/ausgeliefert (können Secrets enthalten). Repo-Zuordnung dreistufig: Flux-HelmRepository (zuverlässig) → lokale `repositories.yaml` (Heuristik, desktop-only) → manueller Override; ohne Zuordnung ehrlich „Quelle unbekannt", kein Raten, kein automatischer ArtifactHub-Call (Privacy). Outdated-Check gegen `index.yaml` mit Pflicht-Cache (~1 h TTL) und `Masterminds/semver`; OCI-Registries ausgeklammert (Status „oci", späterer Punkt). Keine Helm-Aktionen (Rollback/Uninstall) in V. |
| 2026-07-09 | Multiselect (T): kein Backend-Batch-Binding — das Frontend iteriert mit begrenzter Parallelität über die Einzel-Bindings und meldet Ergebnisse pro Ressource (Teilfehler bleiben ausgewählt für Retry). Selection-Key = `namespace/name` innerhalb der aktiven GVR; Checkbox-Spalte ist von der L2-Spaltenreihenfolge ausgenommen. Bulk-Flux-Guard als ein Sammel-Modal statt N Einzel-Popups. |
