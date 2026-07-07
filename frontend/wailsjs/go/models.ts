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

