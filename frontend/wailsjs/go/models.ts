export namespace main {
	
	export class APIResource {
	    group: string;
	    version: string;
	    kind: string;
	    name: string;
	    namespaced: boolean;
	
	    static createFrom(source: any = {}) {
	        return new APIResource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespaced = source["namespaced"];
	    }
	}
	export class ApplyResult {
	    ok: boolean;
	    message: string;
	    group: string;
	    version: string;
	    resource: string;
	    kind: string;
	    namespace: string;
	    name: string;
	    yaml: string;
	
	    static createFrom(source: any = {}) {
	        return new ApplyResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.message = source["message"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.resource = source["resource"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.yaml = source["yaml"];
	    }
	}
	export class ClusterOverviewMetrics {
	    available: boolean;
	    cpuUsage: number;
	    cpuCapacity: number;
	    memoryUsage: number;
	    memoryCapacity: number;
	    nodeReady: number;
	    nodeNotReady: number;
	    podsRunning: number;
	    podsPending: number;
	    podsFailed: number;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterOverviewMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.cpuUsage = source["cpuUsage"];
	        this.cpuCapacity = source["cpuCapacity"];
	        this.memoryUsage = source["memoryUsage"];
	        this.memoryCapacity = source["memoryCapacity"];
	        this.nodeReady = source["nodeReady"];
	        this.nodeNotReady = source["nodeNotReady"];
	        this.podsRunning = source["podsRunning"];
	        this.podsPending = source["podsPending"];
	        this.podsFailed = source["podsFailed"];
	        this.message = source["message"];
	    }
	}
	export class ContextInfo {
	    name: string;
	    cluster: string;
	    user: string;
	    namespace: string;
	    source: string;
	    active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ContextInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cluster = source["cluster"];
	        this.user = source["user"];
	        this.namespace = source["namespace"];
	        this.source = source["source"];
	        this.active = source["active"];
	    }
	}
	export class EventInfo {
	    type: string;
	    reason: string;
	    message: string;
	    count: number;
	    source: string;
	    firstTimestamp: string;
	    lastTimestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new EventInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.count = source["count"];
	        this.source = source["source"];
	        this.firstTimestamp = source["firstTimestamp"];
	        this.lastTimestamp = source["lastTimestamp"];
	    }
	}
	export class FluxProblemResource {
	    kind: string;
	    group: string;
	    version: string;
	    resource: string;
	    namespace: string;
	    name: string;
	    status: string;
	    reason: string;
	    message: string;
	    age: string;
	    revision: string;
	    suspended: boolean;

	    static createFrom(source: any = {}) {
	        return new FluxProblemResource(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.resource = source["resource"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.age = source["age"];
	        this.revision = source["revision"];
	        this.suspended = source["suspended"];
	    }
	}
	export class FluxKindStatus {
	    kind: string;
	    group: string;
	    version: string;
	    resource: string;
	    total: number;
	    ready: number;
	    notReady: number;
	    suspended: number;
	
	    static createFrom(source: any = {}) {
	        return new FluxKindStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.resource = source["resource"];
	        this.total = source["total"];
	        this.ready = source["ready"];
	        this.notReady = source["notReady"];
	        this.suspended = source["suspended"];
	    }
	}
	export class KubeConfigInfo {
	    path: string;
	    isDefault: boolean;
	    exists: boolean;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new KubeConfigInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.isDefault = source["isDefault"];
	        this.exists = source["exists"];
	        this.error = source["error"];
	    }
	}
	export class LocalTerminalInfo {
	    id: string;
	    shell: string;
	    contextName: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalTerminalInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.shell = source["shell"];
	        this.contextName = source["contextName"];
	    }
	}
	export class LogStreamOptions {
	    container: string;
	    tailLines: number;
	    previous: boolean;
	    timestamps: boolean;
	    sinceSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new LogStreamOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.container = source["container"];
	        this.tailLines = source["tailLines"];
	        this.previous = source["previous"];
	        this.timestamps = source["timestamps"];
	        this.sinceSeconds = source["sinceSeconds"];
	    }
	}
	export class MetricPoint {
	    timestamp: string;
	    value: number;
	
	    static createFrom(source: any = {}) {
	        return new MetricPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.value = source["value"];
	    }
	}
	export class MetricSeries {
	    name: string;
	    unit: string;
	    points: MetricPoint[];
	
	    static createFrom(source: any = {}) {
	        return new MetricSeries(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.unit = source["unit"];
	        this.points = this.convertValues(source["points"], MetricPoint);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MetricsAvailability {
	    available: boolean;
	    mode: string;
	    message: string;
	    proxyForbidden: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MetricsAvailability(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.mode = source["mode"];
	        this.message = source["message"];
	        this.proxyForbidden = source["proxyForbidden"];
	    }
	}
	export class PrometheusClusterSelector {
	    label: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new PrometheusClusterSelector(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.value = source["value"];
	    }
	}
	export class PrometheusConnectionTestResult {
	    ok: boolean;
	    mode: string;
	    message: string;
	    sampleCount: number;
	    clusterLabel: string;
	    clusterValues: string[];
	    proxyForbidden: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PrometheusConnectionTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.mode = source["mode"];
	        this.message = source["message"];
	        this.sampleCount = source["sampleCount"];
	        this.clusterLabel = source["clusterLabel"];
	        this.clusterValues = source["clusterValues"];
	        this.proxyForbidden = source["proxyForbidden"];
	    }
	}
	export class PrometheusTarget {
	    accessMode: string;
	    namespace: string;
	    service: string;
	    portName: string;
	    port: number;
	    pathPrefix: string;
	
	    static createFrom(source: any = {}) {
	        return new PrometheusTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessMode = source["accessMode"];
	        this.namespace = source["namespace"];
	        this.service = source["service"];
	        this.portName = source["portName"];
	        this.port = source["port"];
	        this.pathPrefix = source["pathPrefix"];
	    }
	}
	export class PrometheusContextSettings {
	    mode: string;
	    url: string;
	    headers: Record<string, string>;
	    clusterSelector: PrometheusClusterSelector;
	    target: PrometheusTarget;
	
	    static createFrom(source: any = {}) {
	        return new PrometheusContextSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.clusterSelector = this.convertValues(source["clusterSelector"], PrometheusClusterSelector);
	        this.target = this.convertValues(source["target"], PrometheusTarget);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class PrometheusTargetCandidate {
	    namespace: string;
	    service: string;
	    portName: string;
	    port: number;
	    score: number;
	    reasons: string[];
	
	    static createFrom(source: any = {}) {
	        return new PrometheusTargetCandidate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.service = source["service"];
	        this.portName = source["portName"];
	        this.port = source["port"];
	        this.score = source["score"];
	        this.reasons = source["reasons"];
	    }
	}
	export class ResourceQuantitySummary {
	    cpuRequest: number;
	    cpuLimit: number;
	    memoryRequest: number;
	    memoryLimit: number;
	    hasCPURequest: boolean;
	    hasCPULimit: boolean;
	    hasMemRequest: boolean;
	    hasMemLimit: boolean;

	    static createFrom(source: any = {}) {
	        return new ResourceQuantitySummary(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpuRequest = source["cpuRequest"];
	        this.cpuLimit = source["cpuLimit"];
	        this.memoryRequest = source["memoryRequest"];
	        this.memoryLimit = source["memoryLimit"];
	        this.hasCPURequest = source["hasCPURequest"];
	        this.hasCPULimit = source["hasCPULimit"];
	        this.hasMemRequest = source["hasMemRequest"];
	        this.hasMemLimit = source["hasMemLimit"];
	    }
	}
	export class ResourceQuantityInfo {
	    namespace: string;
	    name: string;
	    summary: ResourceQuantitySummary;

	    static createFrom(source: any = {}) {
	        return new ResourceQuantityInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.summary = this.convertValues(source["summary"], ResourceQuantitySummary);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResourceListMetric {
	    namespace: string;
	    name: string;
	    cpu: number;
	    memory: number;
	
	    static createFrom(source: any = {}) {
	        return new ResourceListMetric(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	    }
	}
	export class ResourceMetricsSeries {
	    available: boolean;
	    series: MetricSeries[];
	
	    static createFrom(source: any = {}) {
	        return new ResourceMetricsSeries(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.series = this.convertValues(source["series"], MetricSeries);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CRDGroupRule {
	    id: string;
	    label: string;
	    patterns: string[];
	    icon: string;
	    enabled: boolean;

	    static createFrom(source: any = {}) {
	        return new CRDGroupRule(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.patterns = source["patterns"];
	        this.icon = source["icon"];
	        this.enabled = source["enabled"];
	    }
	}
	export class CRDGroupingSettings {
	    rules: CRDGroupRule[];

	    static createFrom(source: any = {}) {
	        return new CRDGroupingSettings(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rules = this.convertValues(source["rules"], CRDGroupRule);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResourceUISettings {
	    favorites: string[];
	    collapsedSections: Record<string, boolean>;
	    hideEmptyCRDs: boolean;
	    crdGrouping: CRDGroupingSettings;

	    static createFrom(source: any = {}) {
	        return new ResourceUISettings(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.favorites = source["favorites"];
	        this.collapsedSections = source["collapsedSections"];
	        this.hideEmptyCRDs = source["hideEmptyCRDs"];
	        this.crdGrouping = this.convertValues(source["crdGrouping"], CRDGroupingSettings);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TableViewSettings {
	    columnOrder: string[];
	    hiddenColumns: string[];

	    static createFrom(source: any = {}) {
	        return new TableViewSettings(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columnOrder = source["columnOrder"];
	        this.hiddenColumns = source["hiddenColumns"];
	    }
	}
	export class TableColumn {
	    name: string;
	    type: string;
	    priority: number;
	
	    static createFrom(source: any = {}) {
	        return new TableColumn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.priority = source["priority"];
	    }
	}
	export class TableRow {
	    cells: any[];
	    name: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new TableRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cells = source["cells"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	    }
	}
	export class TableResult {
	    columns: TableColumn[];
	    rows: TableRow[];
	
	    static createFrom(source: any = {}) {
	        return new TableResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], TableColumn);
	        this.rows = this.convertValues(source["rows"], TableRow);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

