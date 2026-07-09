# Graph Report - kube-lens  (2026-07-09)

## Corpus Check
- 92 files · ~49,169 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1077 nodes · 1817 edges · 102 communities (50 shown, 52 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5cb9e40`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- types.ts
- prometheus.go
- KubeManager
- quantities.go
- App
- dependencies
- index.ts
- app_terminal.go
- ResourceMetricsTab.tsx
- YamlDrawer.tsx
- Kube Lens
- flux.go
- execSession
- logStreamRegistry
- FluxOverview.tsx
- compilerOptions
- .watchLoop
- package.json
- .convertValues
- models.ts
- MetricSeries
- wails.json
- PrometheusClusterSelector
- YamlCode.tsx
- EventInfo
- env_test.go
- runtime.d.ts
- .PatchResource
- index.ts
- compilerOptions
- CRDGroupingSettings
- PodEnvironment
- ResourceQuantityInfo
- ApplyResult
- App
- ClusterOverviewMetrics
- ContextInfo
- EventInfo
- FluxKindStatus
- FluxProblemResource
- KubeConfigInfo
- LocalTerminalInfo
- TableViewSettings
- MetricsAvailability
- PrometheusConnectionTestResult
- TableRow
- APIResource
- frontend/index.html
- dashboards.ts
- detail.ts
- forms.ts
- shell.ts
- terminalPanel.ts
- EventsOnMultiple
- OFL.txt font license
- kube-lens
- Kube Lens
- types.ts
- T
- FluxKindStatus
- ResourceTable.tsx
- App.d.ts
- FluxKindStatus
- LogStreamOptions
- CLAUDE.md
- Apache License 2.0
- client-go
- Flux
- Mantine
- npm
- PLAN.md
- Prometheus
- React
- TypeScript
- Wails v2
- APIResource
- TableViewSettings
- openKubeConfigDialog
- openKubeConfigDialog
- APIResource
- Capabilities
- FluxProblemResource
- PrometheusConnectionTestResult
- PrometheusTargetCandidate
- ResourceListMetric
- TableColumn
- .DiscoverResources
- .FluxProblemResources
- .GetResourceQuantities
- .GetResourceQuantity
- .ListContexts
- .GetPodEnvironment
- .ListKubeConfigs
- .ListResourceTable
- RawMessage
- Duration

## God Nodes (most connected - your core abstractions)
1. `App` - 35 edges
2. `KubeManager` - 31 edges
3. `App()` - 30 edges
4. `PrometheusContextSettings` - 21 edges
5. `KubeManager` - 17 edges
6. `APIResource` - 16 edges
7. `compilerOptions` - 16 edges
8. `getPath()` - 15 edges
9. `YamlDrawer()` - 12 edges
10. `resourceUISettingsFromSettings()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Kube Lens` --conceptually_related_to--> `SIL Open Font License 1.1`  [INFERRED]
  README.md → frontend/src/assets/fonts/OFL.txt
- `NewApp()` --calls--> `NewKubeManager()`  [INFERRED]
  app.go → kube.go
- `main()` --calls--> `runServer()`  [INFERRED]
  main_desktop.go → server.go
- `main()` --calls--> `runServer()`  [INFERRED]
  main_server.go → server.go
- `TestIsMostlyText()` --calls--> `isMostlyText()`  [INFERRED]
  env_test.go → env.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI/CD Pipeline** — github_workflows_build_document, github_workflows_release_document [INFERRED 0.80]

## Communities (102 total, 52 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.08
Nodes (51): App(), EMPTY_UI_SETTINGS, errText(), getOverviewRenderer(), errText(), FluxRowActions(), errText(), FluxGuardResourceRef (+43 more)

### Community 1 - "types.ts"
Cohesion: 0.11
Nodes (30): CRDGroupingModal(), errText(), ICON_OPTIONS, matchesForRule(), patternMatches(), Props, Props, SectionIcon() (+22 more)

### Community 2 - "prometheus.go"
Cohesion: 0.07
Nodes (41): ClusterOverviewMetrics, MetricPoint, MetricsAvailability, MetricSeries, prometheusAPIResponse, prometheusCacheEntry, PrometheusClusterSelector, PrometheusConnectionTestResult (+33 more)

### Community 4 - "KubeManager"
Cohesion: 0.07
Nodes (35): ClientConfigLoadingRules, Config, DiscoveryInterface, cloneBoolMap(), cloneCRDGroupingSettings(), cloneStringSlice(), cloneTableViewSettings(), defaultKubeConfigPath() (+27 more)

### Community 5 - "quantities.go"
Cohesion: 0.09
Nodes (36): boolValue(), Context, Interface, KubeManager, isMostlyText(), GetOptions, envResolver, PodEnvironment (+28 more)

### Community 6 - "App"
Cohesion: 0.15
Nodes (3): Context, App, KubeManager

### Community 7 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, @codemirror/lang-yaml, i18next, i18next-browser-languagedetector, @mantine/core, @mantine/hooks, @mantine/notifications, react (+25 more)

### Community 8 - "index.ts"
Cohesion: 0.18
Nodes (19): ConditionsTable(), statusColor(), ConfigMapSecretOverview(), decodeBase64(), GenericOverview(), detailRenderers, MetadataCard(), NodeOverview() (+11 more)

### Community 9 - "app_terminal.go"
Cohesion: 0.12
Nodes (17): cleanupLocalTerminal(), CancelFunc, Context, App, KubeManager, Mutex, homeDir(), localShell() (+9 more)

### Community 10 - "ResourceMetricsTab.tsx"
Cohesion: 0.18
Nodes (3): CRDGroupingSettings, CRDGroupRule, ResourceUISettings

### Community 11 - "YamlDrawer.tsx"
Cohesion: 0.11
Nodes (24): Conn, FS, HandlerFunc, callRequest, callResponse, eventFrame, eventHub, serverEmitter (+16 more)

### Community 12 - "Kube Lens"
Cohesion: 0.47
Nodes (6): Build workflow, Release workflow, Linux system dependencies (GTK, WebKit), Node.js, NSIS installer, Wails CLI

### Community 13 - "flux.go"
Cohesion: 0.13
Nodes (22): extractSourceRef(), fluxOwnershipFromLabels(), fluxProblemPredicate(), fluxRevision(), fluxSuspendedPredicate(), APIResource, KubeManager, isReady() (+14 more)

### Community 14 - "execSession"
Cohesion: 0.16
Nodes (10): App, CancelFunc, App, Mutex, execEmitter, execRegistry, execSession, termSizeQueue (+2 more)

### Community 15 - "logStreamRegistry"
Cohesion: 0.15
Nodes (10): containerNames(), CancelFunc, Context, App, Mutex, Request, Clientset, LogStreamOptions (+2 more)

### Community 16 - "FluxOverview.tsx"
Cohesion: 0.16
Nodes (15): defaultProblemStatus(), Props, suspendedStatus(), buildSections(), CategorySection, FluxOverview(), FluxOverviewProps, Props (+7 more)

### Community 17 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 18 - ".watchLoop"
Cohesion: 0.15
Nodes (11): Duration, watchRegistry, NamespaceableResourceInterface, Timer, consumeWatch(), CancelFunc, Context, Interface (+3 more)

### Community 19 - "package.json"
Cohesion: 0.12
Nodes (15): author, bugs, url, description, homepage, keywords, license, main (+7 more)

### Community 20 - ".convertValues"
Cohesion: 0.20
Nodes (14): LogsTab(), Props, TAIL_OPTIONS, Props, SHELLS, TerminalTab(), ExecResize(), ExecWrite() (+6 more)

### Community 21 - "models.ts"
Cohesion: 0.12
Nodes (6): FluxKindStatus, FluxOwnership, KubeConfigInfo, main, MetricsAvailability, ResourceListMetric

### Community 22 - "MetricSeries"
Cohesion: 0.17
Nodes (4): MetricPoint, MetricSeries, ResourceMetricsSeries, TableResult

### Community 23 - "wails.json"
Cohesion: 0.18
Nodes (10): author, email, name, frontend:build, frontend:dev:serverUrl, frontend:dev:watcher, frontend:install, name (+2 more)

### Community 24 - "PrometheusClusterSelector"
Cohesion: 0.20
Nodes (3): PrometheusClusterSelector, PrometheusContextSettings, PrometheusTarget

### Community 25 - "YamlCode.tsx"
Cohesion: 0.31
Nodes (8): classifyValue(), COLORS, Props, Segment, splitComment(), tokenizeLine(), TokenKind, YamlCode()

### Community 26 - "EventInfo"
Cohesion: 0.25
Nodes (3): App, KubeManager, EventInfo

### Community 27 - "env_test.go"
Cohesion: 0.50
Nodes (7): T, Unstructured, testConfigMap(), TestEnvEntriesLiteralAndRefs(), TestEnvFromExpansionWithPrefix(), TestIsMostlyText(), testSecret()

### Community 28 - "runtime.d.ts"
Cohesion: 0.25
Nodes (7): EnvironmentInfo, NotificationAction, NotificationCategory, NotificationOptions, Position, Screen, Size

### Community 30 - "index.ts"
Cohesion: 0.29
Nodes (6): colorSchemeManager, theme, CallResponse, Handler, installServerBridge(), serverToken()

### Community 31 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 32 - "CRDGroupingSettings"
Cohesion: 0.28
Nodes (12): clampHeight(), errText(), initialHeight(), Props, TerminalInstance(), TerminalPanel(), TerminalTabState, LocalTerminalResize() (+4 more)

### Community 35 - "ApplyResult"
Cohesion: 0.33
Nodes (3): App, KubeManager, ApplyResult

### Community 36 - "App"
Cohesion: 0.22
Nodes (4): FluxProblemResource, App, FluxKindStatus, FluxOwnership

### Community 38 - "ContextInfo"
Cohesion: 0.40
Nodes (8): formatBytes(), formatCPU(), formatMetricValue(), formatRate(), ResourceMetricsTab(), ReferenceLine, ResourceMetricsSeries, GetResourceMetricsSeries()

### Community 39 - "EventInfo"
Cohesion: 0.33
Nodes (10): ChartPoint, clamp(), computeYTicks(), dayKey(), evenTickIndices(), niceStepBase10(), niceStepBinary(), Props (+2 more)

### Community 40 - "FluxKindStatus"
Cohesion: 0.26
Nodes (8): Props, AlertKind, AlertState, errText(), isConflict(), YamlEditor(), YamlEditorProps, ApplyResourceYAML()

### Community 41 - "FluxProblemResource"
Cohesion: 0.12
Nodes (15): ContextInfo, KubeConfigInfo, MetricsAvailability, MetricSeries, PodEnvironment, PodEnvironmentEntry, PrometheusClusterSelector, PrometheusConnectionTestResult (+7 more)

### Community 46 - "PrometheusConnectionTestResult"
Cohesion: 0.25
Nodes (7): Building, Contributing to Kube Lens, Developing, Linux system packages, Prerequisites, Pull requests, Roadmap

### Community 48 - "APIResource"
Cohesion: 0.23
Nodes (14): EMPTY_SETTINGS, errText(), HeaderRow, headersToRows(), normalizeSettings(), PrometheusConfigModal(), Props, rowsToHeaders() (+6 more)

### Community 62 - "Kube Lens"
Cohesion: 0.17
Nodes (11): Building, Contributing, Development, Features, Kube Lens, License, Linux system packages, Screenshots (+3 more)

### Community 63 - "types.ts"
Cohesion: 0.18
Nodes (6): NewApp(), Capabilities, eventEmitter, main(), ensureToolPath(), main()

### Community 64 - "T"
Cohesion: 0.18
Nodes (15): Props, Props, DisplayColumn, ExtraTableColumn, mergeColumnOrder(), Props, renderCell(), ResourceTable() (+7 more)

### Community 65 - "FluxKindStatus"
Cohesion: 0.38
Nodes (6): ClusterOverview(), percent(), Props, UsageCard(), ClusterOverviewMetrics, GetClusterOverviewMetrics()

### Community 66 - "ResourceTable.tsx"
Cohesion: 0.24
Nodes (10): KubeManager, rolloutRestartPatch(), scalePatch(), T, TestRolloutRestartPatch(), TestScalePatch(), TestValidateRolloutRestartTarget(), TestValidateScaleTarget() (+2 more)

### Community 71 - "Apache License 2.0"
Cohesion: 0.40
Nodes (4): Bundle, de, en, modules

## Knowledge Gaps
- **161 isolated node(s):** `Features`, `Screenshots`, `Development`, `Building`, `Linux system packages` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App` connect `App` to `.ListContexts`, `PodEnvironment`, `.ListKubeConfigs`, `.ListResourceTable`, `MetricsAvailability`, `.watchLoop`, `TableViewSettings`, `.GetResourceQuantity`, `FluxProblemResource`, `.DiscoverResources`, `.GetResourceQuantities`, `types.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `Settings` connect `KubeManager` to `PrometheusClusterSelector`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `PrometheusContextSettings` connect `PrometheusClusterSelector` to `KubeManager`, `models.ts`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `Features`, `Screenshots`, `Development` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07731694828469023 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10810810810810811 - nodes in this community are weakly interconnected._
- **Should `prometheus.go` be split into smaller, more focused modules?**
  _Cohesion score 0.07161125319693094 - nodes in this community are weakly interconnected._