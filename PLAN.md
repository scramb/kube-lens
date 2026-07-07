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
- [ ] Ressourcen anpinnen (Stern-Icon im NavLink-Hover); Favoriten-Sektion ganz oben.
- [ ] Persistenz in Settings **pro Kontext** (`favorites: { [contextName]: gvr[] }`).
- [ ] Collapse-Zustand der Sektionen persistieren.
- [ ] Optionaler Toggle „leere CRDs ausblenden": Instanz-Count lazy per List mit
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
- [ ] YAML-Tab: Syntax-Highlighting ergänzen (aktuell schlichtes `<pre>`; verschoben,
      z. B. CodeMirror-Read-Only zusammen mit E2).

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
- [ ] Settings-Erweiterung **pro Kontext**:
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
- [ ] Konfigurations-Modal (pro Kontext, erreichbar über Header-Settings):
      Modus-Wahl, URL + Header-Editor, Label-Name-Feld, Werte-Dropdown via
      `/api/v1/label/<label>/values`, „Verbindung testen"-Button (Query `up`, zeigt
      Sample-Count und erkannte Cluster-Label-Werte).

### B2 — Backend: Zugriffswege
- [ ] **Autodiscovery:** Services clusterweit scannen nach bekannten Signaturen
      (Label `app.kubernetes.io/name in (prometheus, thanos-query, mimir)`, Namens-
      Heuristiken `prometheus-operated`, `*-kube-prometheus-*`, Port `9090`/`web`).
      Kandidatenliste zurückgeben; UI lässt den User bestätigen (kein stilles Raten).
- [ ] Zugriff auf In-Cluster-Instanzen über **API-Server-Service-Proxy**
      (`/api/v1/namespaces/<ns>/services/<name>:<port>/proxy/`) — nutzt bestehende
      Kubeconfig-Auth, kein Portmanagement.
- [ ] Fallback **Port-Forward** (client-go SPDY), falls Proxy per RBAC verboten
      (403 erkennen → automatisch umschalten, Zustand in UI anzeigen).
- [ ] Manueller Modus: direkter HTTP-Client mit konfigurierten Headern.

### B3 — Backend: Query-Schicht
Abhängig von: B1, B2.
- [ ] Client für `/api/v1/query` und `/api/v1/query_range` mit:
      Matcher-Injektion (`clusterSelector` wird in jede Query eingefügt),
      Timeout, Ergebnis-Cache (~10 s) gegen Polling-Spam.
- [ ] Query-Katalog (parametrisiert nach Namespace/Pod/Node), Standard-Metriken:
      cAdvisor (`container_cpu_usage_seconds_total` als Rate,
      `container_memory_working_set_bytes`), kube-state-metrics (Restarts, Phasen),
      node-exporter (Node-CPU/Mem/Disk). Katalog als Datenstruktur, nicht verstreut.

### B4 — Anzeige
Abhängig von: A4 (Metriken-Tab), B3.
- [ ] **Tabellen-Spalten:** CPU/Memory in Pod- und Node-Listen (ein Batch-Instant-Query
      pro Refresh, gejoint über Pod/Node-Name).
- [ ] **Metriken-Tab im Drawer:** Zeitreihen-Charts (CPU, Memory, Netzwerk; Zeitraum
      1h/6h/24h) mit `@mantine/charts`.
- [ ] **Cluster-Übersichtsseite** (oberster Sidebar-Eintrag): Kapazität vs. Nutzung
      (CPU/Mem), Node-Status, Pod-Zähler. Bewusst schlank — kein Grafana-Ersatz.
- [ ] **Graceful Degradation:** ohne konfigurierte/erreichbare Quelle verschwinden
      Spalten/Tabs/Seite kommentarlos; Fehlzustand nur im Konfigurations-Modal sichtbar.

---

## Milestone D — Pod-Logs & Exec-Terminal

**Ziel:** Logs live in der App lesen und Container-Shells öffnen — die zwei
häufigsten „dann doch wieder kubectl"-Momente eliminieren.

### D1 — Backend: Log-Streaming
- [ ] `StartLogStream(ns, pod, container, opts)` via client-go `GetLogs` mit
      `follow=true`; Optionen: `tailLines`, `previous`, `timestamps`, `sinceSeconds`.
- [ ] Zeilen über Wails-Events (`EventsEmit`, Topic `logs:<streamID>`) ans Frontend
      pushen; `StopLogStream(streamID)` zum Aufräumen; Streams bei Kontext-Wechsel
      und Drawer-Close serverseitig beenden (Leak-Schutz).

### D2 — Frontend: Logs-Tab im Pod-Drawer
Abhängig von: A4, D1.
- [ ] Neuer Tab **Logs** (nur für Pods): Container-Dropdown (inkl. initContainers),
      Follow-Toggle mit Auto-Scroll, Pause bei manuellem Hochscrollen,
      Text-Filter, Zeilenumbruch-Toggle, „Previous"-Logs, Download als Datei.
- [ ] Virtualisierte Liste für lange Logs (kein DOM-Kollaps bei 100k Zeilen).

### D3 — Exec-Terminal
Abhängig von: A4.
- [ ] Backend: `remotecommand.NewSPDYExecutor` mit PTY; stdin per Bind-Methode,
      stdout/stderr per Wails-Events; Terminal-Resize durchreichen.
- [ ] Frontend: xterm.js im Drawer-Tab **Terminal** (nur Pods); Shell-Fallback-Kette
      (`/bin/bash` → `/bin/sh`); klare Fehlermeldung, wenn der Container keine Shell hat.

---

## Milestone E — YAML bearbeiten & anwenden

**Ziel:** Ressourcen direkt aus der App ändern und neu anlegen — Server-Side Apply,
damit Feld-Ownership sauber bleibt.

### E1 — Backend: Apply
Abhängig von: C1 (gleiche Infrastruktur-Schicht).
- [ ] `ApplyResource(yaml string, force bool)` via dynamischem Client mit
      Server-Side Apply, `FieldManager: "kube-lens"`; Konflikte (409) strukturiert
      zurückgeben (welcher Manager besitzt welches Feld), `force` als Option.
- [ ] Dry-Run-Variante (`dryRun=server`) für Validierung vor dem echten Apply.

### E2 — Frontend: editierbarer YAML-Tab
Abhängig von: A4, E1.
- [ ] YAML-Tab bekommt Bearbeiten-Modus: CodeMirror 6 (leichtgewichtig, kein Monaco)
      mit YAML-Syntax, Dirty-State-Anzeige, Speichern = Dry-Run → bei Erfolg Apply,
      Server-Fehler (Validation/Conflict) inline anzeigen.
- [ ] Verwerfen-Schutz bei ungespeicherten Änderungen (Drawer-Close/Tab-Wechsel).

### E3 — Ressourcen neu anlegen
Abhängig von: E1.
- [ ] „+ Neu"-Button je Ressourcen-Liste: leerer Editor mit Kind-Skeleton
      (apiVersion/kind/metadata vorausgefüllt aus der aktuellen Auswahl).

---

## Milestone F — Watch-Streams statt Polling

**Ziel:** Echte Live-Updates; das 5-Sekunden-Polling und das Fast-Polling nach
Flux-Aktionen (C4) ersetzen.

### F1 — Backend: Watch-Manager
- [ ] Ein Watch pro aktiver Tabellen-Ansicht (GVR + Namespace), Updates über
      Wails-Events; Start/Stop vom Frontend gesteuert, max. 1 aktiver Watch.
- [ ] **Table-Watch nutzen:** Watch-Request mit `Accept: …;as=Table` (wie
      `kubectl get -w`) — liefert Zeilen im selben Format wie die bestehende
      Tabellen-API, kein zweiter Rendering-Pfad im Frontend.
- [ ] Robustheit: Reconnect mit Backoff, `410 Gone` → Relist + neuer Watch,
      `resourceVersion`-Buchführung.

### F2 — Frontend: Subscription statt Interval
Abhängig von: F1.
- [ ] Tabellen-Polling durch Event-Subscription ersetzen (add/update/delete
      inkrementell einarbeiten); Fallback auf bisheriges Polling, wenn Watch
      per RBAC verboten ist (403 → degradieren, Hinweis-Badge).
- [ ] Drawer (Übersicht/Conditions) bei Update der geöffneten Ressource live
      aktualisieren; Flux-Fast-Polling aus C4 entfernen.

---

## Milestone G — CI, Releases & Cross-Platform-Builds

**Ziel:** Reproduzierbare Builds für macOS, Windows, Linux — Voraussetzung fürs
Open-Source-Release.

### G1 — Repo-Grundlagen
- [ ] `git init` + Initial-Commit; `.gitignore` (`build/bin/`, `node_modules/`,
      `frontend/dist/`, `frontend/wailsjs/` generiert lassen? → Entscheidung:
      committen, da Build sonst wails-CLI vor `tsc` braucht).
- [ ] GitHub-Repo, Lizenz wählen (Vorschlag: Apache-2.0 oder MIT), README auf
      Open-Source-Publikum ausrichten.

### G2 — Build-Pipeline
Abhängig von: G1.
- [ ] GitHub Actions Matrix: `macos-latest`, `windows-latest`, `ubuntu-latest`;
      je `wails build`, Artefakte hochladen.
- [ ] Linux: `libwebkit2gtk-4.1-dev`-Abhängigkeit dokumentieren und in CI
      installieren; Binary + optional AppImage.
- [ ] Windows: NSIS-Installer (`wails build -nsis`).

### G3 — Release-Workflow
Abhängig von: G2.
- [ ] Tag `v*` → Release-Build aller Plattformen, Checksums, GitHub Release
      mit Changelog.
- [ ] Offen: macOS Signing/Notarization (braucht Apple-Developer-Account —
      bis dahin: unsigned mit dokumentiertem Gatekeeper-Workaround).

---

## Milestone H — Internationalisierung (i18n)

**Ziel:** Englisch als Default fürs Open-Source-Release, Deutsch als zweite Locale.

### H1 — Infrastruktur
- [ ] `react-i18next` einführen; alle UI-Strings aus den Komponenten in
      Locale-Dateien (`en.json`, `de.json`) extrahieren; Englisch = Fallback.
- [ ] **Backend-Fehlermeldungen entdeutschen:** `kube.go` gibt aktuell deutsche
      Fehlertexte zurück — auf Englisch bzw. strukturierte Fehler-Codes umstellen,
      Übersetzung passiert im Frontend.

### H2 — Sprachwahl & Formate
Abhängig von: H1.
- [ ] Sprachumschalter in den Settings (Default: Systemsprache, sonst Englisch);
      Persistenz in settings.json.
- [ ] Datums-/Zahlenformatierung über `Intl` an die gewählte Locale koppeln.

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
