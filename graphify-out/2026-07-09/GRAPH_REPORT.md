# Graph Report - kube-lens  (2026-07-09)

## Corpus Check
- 92 files · ~49,169 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1077 nodes · 1872 edges · 100 communities (46 shown, 54 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fe878fa9`
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

## God Nodes (most connected - your core abstractions)
1. `App()` - 38 edges
2. `App` - 35 edges
3. `KubeManager` - 31 edges
4. `PrometheusContextSettings` - 21 edges
5. `APIResource` - 17 edges
6. `KubeManager` - 17 edges
7. `compilerOptions` - 16 edges
8. `getPath()` - 15 edges
9. `PrometheusConfigModal()` - 12 edges
10. `YamlDrawer()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `NewApp()` --calls--> `NewKubeManager()`  [INFERRED]
  app.go → kube.go
- `TestIsMostlyText()` --calls--> `isMostlyText()`  [INFERRED]
  env_test.go → env.go
- `TestFluxResourcePredicates()` --calls--> `fluxProblemPredicate()`  [INFERRED]
  flux_test.go → flux.go
- `TestFluxResourcePredicates()` --calls--> `fluxSuspendedPredicate()`  [INFERRED]
  flux_test.go → flux.go
- `main()` --calls--> `runServer()`  [INFERRED]
  main_desktop.go → server.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI/CD Pipeline** — github_workflows_build_document, github_workflows_release_document [INFERRED 0.80]

## Communities (100 total, 54 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.05
Nodes (76): App(), EMPTY_UI_SETTINGS, errText(), ClusterOverview(), percent(), Props, UsageCard(), KubeConfigModal() (+68 more)

### Community 1 - "types.ts"
Cohesion: 0.25
Nodes (12): buildCrdNav(), enabledRules(), MatchedGroup, matchesPattern(), matchGroup(), normalizeCRDGroupingSettings(), normalizeCRDGroupRule(), productForGroup() (+4 more)

### Community 2 - "prometheus.go"
Cohesion: 0.08
Nodes (39): ClusterOverviewMetrics, MetricPoint, MetricsAvailability, MetricSeries, prometheusAPIResponse, PrometheusClusterSelector, PrometheusConnectionTestResult, PrometheusContextSettings (+31 more)

### Community 4 - "KubeManager"
Cohesion: 0.07
Nodes (37): ClientConfigLoadingRules, DiscoveryInterface, cloneBoolMap(), cloneCRDGroupingSettings(), cloneStringSlice(), cloneTableViewSettings(), defaultKubeConfigPath(), Config (+29 more)

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
Cohesion: 0.17
Nodes (4): CRDGroupingSettings, CRDGroupRule, ResourceUISettings, TableResult

### Community 11 - "YamlDrawer.tsx"
Cohesion: 0.11
Nodes (24): Conn, FS, HandlerFunc, callRequest, callResponse, eventFrame, eventHub, serverEmitter (+16 more)

### Community 12 - "Kube Lens"
Cohesion: 0.43
Nodes (7): Build workflow, Release workflow, Go, Linux system dependencies (GTK, WebKit), Node.js, NSIS installer, Wails CLI

### Community 13 - "flux.go"
Cohesion: 0.13
Nodes (22): extractSourceRef(), fluxOwnershipFromLabels(), fluxProblemPredicate(), fluxRevision(), fluxSuspendedPredicate(), APIResource, KubeManager, isReady() (+14 more)

### Community 14 - "execSession"
Cohesion: 0.16
Nodes (10): App, CancelFunc, App, Mutex, execEmitter, execRegistry, execSession, termSizeQueue (+2 more)

### Community 15 - "logStreamRegistry"
Cohesion: 0.15
Nodes (10): containerNames(), CancelFunc, Context, App, Mutex, Request, Unstructured, Clientset (+2 more)

### Community 16 - "FluxOverview.tsx"
Cohesion: 0.16
Nodes (17): defaultProblemStatus(), Props, suspendedStatus(), buildSections(), CategorySection, FluxOverview(), FluxOverviewProps, FluxProblemsOverview() (+9 more)

### Community 17 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 18 - ".watchLoop"
Cohesion: 0.15
Nodes (11): watchRegistry, NamespaceableResourceInterface, Timer, consumeWatch(), CancelFunc, Context, Duration, Interface (+3 more)

### Community 19 - "package.json"
Cohesion: 0.12
Nodes (15): author, bugs, url, description, homepage, keywords, license, main (+7 more)

### Community 21 - "models.ts"
Cohesion: 0.18
Nodes (4): ContextInfo, FluxKindStatus, main, MetricsAvailability

### Community 22 - "MetricSeries"
Cohesion: 0.18
Nodes (3): MetricPoint, MetricSeries, ResourceMetricsSeries

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
Cohesion: 0.17
Nodes (10): Bundle, de, en, modules, colorSchemeManager, theme, CallResponse, Handler (+2 more)

### Community 31 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 32 - "CRDGroupingSettings"
Cohesion: 0.23
Nodes (11): Props, Props, SectionIcon(), sectionKey(), Sidebar(), Props, NavItem, NavSection (+3 more)

### Community 35 - "ApplyResult"
Cohesion: 0.33
Nodes (3): App, KubeManager, ApplyResult

### Community 36 - "App"
Cohesion: 0.22
Nodes (4): FluxProblemResource, App, FluxKindStatus, FluxOwnership

### Community 38 - "ContextInfo"
Cohesion: 0.27
Nodes (10): CRDGroupingModal(), errText(), ICON_OPTIONS, matchesForRule(), patternMatches(), Props, DEFAULT_CRD_GROUP_RULES, validateCRDGroupRule() (+2 more)

### Community 39 - "EventInfo"
Cohesion: 0.33
Nodes (10): ChartPoint, clamp(), computeYTicks(), dayKey(), evenTickIndices(), niceStepBase10(), niceStepBinary(), Props (+2 more)

### Community 40 - "FluxKindStatus"
Cohesion: 0.11
Nodes (27): getOverviewRenderer(), NewResourceModal(), Props, AlertKind, AlertState, errText(), isConflict(), YamlEditor() (+19 more)

### Community 41 - "FluxProblemResource"
Cohesion: 0.13
Nodes (14): ContextInfo, MetricsAvailability, MetricSeries, PodEnvironment, PodEnvironmentEntry, PrometheusClusterSelector, PrometheusConnectionTestResult, PrometheusContextSettings (+6 more)

### Community 48 - "APIResource"
Cohesion: 0.23
Nodes (14): EMPTY_SETTINGS, errText(), HeaderRow, headersToRows(), normalizeSettings(), PrometheusConfigModal(), Props, rowsToHeaders() (+6 more)

### Community 62 - "Kube Lens"
Cohesion: 0.10
Nodes (18): Building, Contributing to Kube Lens, Developing, Linux system packages, Prerequisites, Pull requests, Roadmap, Building (+10 more)

### Community 63 - "types.ts"
Cohesion: 0.33
Nodes (4): NewApp(), main(), ensureToolPath(), main()

### Community 64 - "T"
Cohesion: 0.23
Nodes (11): Props, DisplayColumn, ExtraTableColumn, mergeColumnOrder(), Props, renderCell(), ResourceTable(), STATUS_COLORS (+3 more)

### Community 66 - "ResourceTable.tsx"
Cohesion: 0.24
Nodes (10): KubeManager, rolloutRestartPatch(), scalePatch(), T, TestRolloutRestartPatch(), TestScalePatch(), TestValidateRolloutRestartTarget(), TestValidateScaleTarget() (+2 more)

## Knowledge Gaps
- **163 isolated node(s):** `KubeManager`, `KubeManager`, `App`, `name`, `private` (+158 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NewApp()` connect `types.ts` to `FluxKindStatus`, `KubeManager`, `App`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `NewKubeManager()` connect `KubeManager` to `types.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `KubeManager`, `KubeManager`, `App` to the rest of the system?**
  _163 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052503052503052504 - nodes in this community are weakly interconnected._
- **Should `prometheus.go` be split into smaller, more focused modules?**
  _Cohesion score 0.07507914970601538 - nodes in this community are weakly interconnected._
- **Should `runtime.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Should `KubeManager` be split into smaller, more focused modules?**
  _Cohesion score 0.06874669487043893 - nodes in this community are weakly interconnected._