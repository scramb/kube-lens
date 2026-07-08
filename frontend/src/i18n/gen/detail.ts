export const detail = {
  en: {
    // Tabs
    'detail.tab.overview': 'Overview',
    'detail.tab.yaml': 'YAML',
    'detail.tab.logs': 'Logs',
    'detail.tab.terminal': 'Terminal',
    'detail.tab.events': 'Events',
    'detail.tab.metrics': 'Metrics',

    // Flux actions
    'detail.action.reconcile': 'Reconcile',
    'detail.action.reconcileWithSource': 'Reconcile with source',
    'detail.action.suspend': 'Suspend',
    'detail.action.resume': 'Resume',

    // Common actions
    'detail.action.delete': 'Delete',
    'detail.cancel': 'Cancel',

    // YAML copy
    'detail.yaml.copy': 'Copy YAML',
    'detail.yaml.copied': 'Copied',
    'detail.yaml.error': 'Error: {{message}}',

    // Delete resource
    'detail.delete.tooltip': 'Delete resource',
    'detail.delete.title': 'Delete resource?',
    'detail.delete.confirm': '{{kind}} {{name}} will be permanently deleted.',
    'detail.delete.confirmInNamespace':
      '{{kind}} {{name}} in namespace {{namespace}} will be permanently deleted.',

    // Badge
    'detail.suspended': 'suspended',

    // Notifications
    'detail.notify.reconcileRequested': 'Reconcile requested',
    'detail.notify.reconcileWithSourceRequested': 'Reconcile with source requested',
    'detail.notify.suspended': 'Suspended',
    'detail.notify.resumed': 'Resumed',

    // Events table
    'detail.events.type': 'Type',
    'detail.events.reason': 'Reason',
    'detail.events.message': 'Message',
    'detail.events.count': 'Count',
    'detail.events.last': 'Last',
    'detail.events.none': 'No events',

    // Metadata card
    'detail.metadata': 'Metadata',
    'detail.metadata.name': 'Name',
    'detail.metadata.namespace': 'Namespace',
    'detail.metadata.uid': 'UID',
    'detail.metadata.age': 'Age',
    'detail.metadata.labels': 'Labels',
    'detail.metadata.annotations': 'Annotations',
    'detail.metadata.ownerReferences': 'Owner references',

    // Conditions table
    'detail.conditions': 'Conditions',
    'detail.conditions.type': 'Type',
    'detail.conditions.status': 'Status',
    'detail.conditions.reason': 'Reason',
    'detail.conditions.message': 'Message',
    'detail.conditions.lastTransitionTime': 'LastTransitionTime',

    // Pod overview
    'detail.pod': 'Pod',
    'detail.pod.phase': 'Phase',
    'detail.pod.node': 'Node',
    'detail.pod.qos': 'QoS',
    'detail.pod.podIp': 'Pod IP',
    'detail.pod.start': 'Start',
    'detail.pod.containers': 'Containers',
    'detail.pod.volumes': 'Volumes',
    'detail.pod.col.name': 'Name',
    'detail.pod.col.image': 'Image',
    'detail.pod.col.ready': 'Ready',
    'detail.pod.col.restarts': 'Restarts',
    'detail.pod.col.state': 'State',
    'detail.pod.col.cpu': 'CPU (req/lim)',
    'detail.pod.col.mem': 'Mem (req/lim)',

    // Workload overview
    'detail.workload': 'Workload',
    'detail.workload.desired': 'Desired',
    'detail.workload.ready': 'Ready',
    'detail.workload.available': 'Available',
    'detail.workload.updated': 'Updated',
    'detail.workload.strategy': 'Strategy',
    'detail.workload.selector': 'Selector',
    'detail.workload.containerImages': 'Container images',
    'detail.workload.col.name': 'Name',
    'detail.workload.col.image': 'Image',

    // Service overview
    'detail.service': 'Service',
    'detail.service.type': 'Type',
    'detail.service.clusterIp': 'ClusterIP',
    'detail.service.externalIps': 'External IPs',
    'detail.service.loadBalancer': 'LoadBalancer',
    'detail.service.selector': 'Selector',
    'detail.service.ports': 'Ports',
    'detail.service.col.name': 'Name',
    'detail.service.col.port': 'Port',
    'detail.service.col.targetPort': 'TargetPort',
    'detail.service.col.protocol': 'Protocol',
    'detail.service.col.nodePort': 'NodePort',

    // ConfigMap/Secret overview
    'detail.data': 'Data',
    'detail.data.none': 'No data available.',
    'detail.data.revealAll': 'Reveal all',
    'detail.data.hideAll': 'Hide all',
    'detail.data.revealAllAria': 'Reveal all values',
    'detail.data.toggleAria': 'Toggle value',
    'detail.data.reveal': 'Reveal',
    'detail.data.hide': 'Hide',
    'detail.data.col.key': 'Key',
    'detail.data.col.value': 'Value',
    'detail.data.base64Decoded': '(base64 decoded)',

    // Node overview
    'detail.node.capacity': 'Capacity',
    'detail.node.resource': 'Resource',
    'detail.node.capacityCol': 'Capacity',
    'detail.node.allocatable': 'Allocatable',
    'detail.node.system': 'System',
    'detail.node.kubeletVersion': 'Kubelet version',
    'detail.node.osImage': 'OS image',
    'detail.node.containerRuntime': 'Container runtime',
    'detail.node.addresses': 'Addresses',
    'detail.node.taints': 'Taints',

    // YAML code
    'detail.yaml.notLoaded': 'No YAML loaded.',

    // Resource table
    'detail.table.namespace': 'Namespace',
    'detail.table.empty': 'No {{kind}} resources found',
  },
  de: {
    // Tabs
    'detail.tab.overview': 'Übersicht',
    'detail.tab.yaml': 'YAML',
    'detail.tab.logs': 'Logs',
    'detail.tab.terminal': 'Terminal',
    'detail.tab.events': 'Events',
    'detail.tab.metrics': 'Metriken',

    // Flux actions
    'detail.action.reconcile': 'Reconcile',
    'detail.action.reconcileWithSource': 'Reconcile with source',
    'detail.action.suspend': 'Suspend',
    'detail.action.resume': 'Resume',

    // Common actions
    'detail.action.delete': 'Löschen',
    'detail.cancel': 'Abbrechen',

    // YAML copy
    'detail.yaml.copy': 'YAML kopieren',
    'detail.yaml.copied': 'Kopiert',
    'detail.yaml.error': 'Fehler: {{message}}',

    // Delete resource
    'detail.delete.tooltip': 'Ressource löschen',
    'detail.delete.title': 'Ressource löschen?',
    'detail.delete.confirm': '{{kind}} {{name}} wird endgültig gelöscht.',
    'detail.delete.confirmInNamespace':
      '{{kind}} {{name}} im Namespace {{namespace}} wird endgültig gelöscht.',

    // Badge
    'detail.suspended': 'pausiert',

    // Notifications
    'detail.notify.reconcileRequested': 'Reconcile angefordert',
    'detail.notify.reconcileWithSourceRequested': 'Reconcile mit Source angefordert',
    'detail.notify.suspended': 'Pausiert',
    'detail.notify.resumed': 'Fortgesetzt',

    // Events table
    'detail.events.type': 'Typ',
    'detail.events.reason': 'Grund',
    'detail.events.message': 'Nachricht',
    'detail.events.count': 'Anzahl',
    'detail.events.last': 'Zuletzt',
    'detail.events.none': 'Keine Events',

    // Metadata card
    'detail.metadata': 'Metadaten',
    'detail.metadata.name': 'Name',
    'detail.metadata.namespace': 'Namespace',
    'detail.metadata.uid': 'UID',
    'detail.metadata.age': 'Alter',
    'detail.metadata.labels': 'Labels',
    'detail.metadata.annotations': 'Annotations',
    'detail.metadata.ownerReferences': 'Owner-References',

    // Conditions table
    'detail.conditions': 'Conditions',
    'detail.conditions.type': 'Type',
    'detail.conditions.status': 'Status',
    'detail.conditions.reason': 'Reason',
    'detail.conditions.message': 'Message',
    'detail.conditions.lastTransitionTime': 'LastTransitionTime',

    // Pod overview
    'detail.pod': 'Pod',
    'detail.pod.phase': 'Phase',
    'detail.pod.node': 'Node',
    'detail.pod.qos': 'QoS',
    'detail.pod.podIp': 'Pod-IP',
    'detail.pod.start': 'Start',
    'detail.pod.containers': 'Container',
    'detail.pod.volumes': 'Volumes',
    'detail.pod.col.name': 'Name',
    'detail.pod.col.image': 'Image',
    'detail.pod.col.ready': 'Ready',
    'detail.pod.col.restarts': 'Restarts',
    'detail.pod.col.state': 'State',
    'detail.pod.col.cpu': 'CPU (req/lim)',
    'detail.pod.col.mem': 'Mem (req/lim)',

    // Workload overview
    'detail.workload': 'Workload',
    'detail.workload.desired': 'Gewünscht',
    'detail.workload.ready': 'Ready',
    'detail.workload.available': 'Verfügbar',
    'detail.workload.updated': 'Aktualisiert',
    'detail.workload.strategy': 'Strategie',
    'detail.workload.selector': 'Selector',
    'detail.workload.containerImages': 'Container-Images',
    'detail.workload.col.name': 'Name',
    'detail.workload.col.image': 'Image',

    // Service overview
    'detail.service': 'Service',
    'detail.service.type': 'Typ',
    'detail.service.clusterIp': 'ClusterIP',
    'detail.service.externalIps': 'External IPs',
    'detail.service.loadBalancer': 'LoadBalancer',
    'detail.service.selector': 'Selector',
    'detail.service.ports': 'Ports',
    'detail.service.col.name': 'Name',
    'detail.service.col.port': 'Port',
    'detail.service.col.targetPort': 'TargetPort',
    'detail.service.col.protocol': 'Protokoll',
    'detail.service.col.nodePort': 'NodePort',

    // ConfigMap/Secret overview
    'detail.data': 'Daten',
    'detail.data.none': 'Keine Daten vorhanden.',
    'detail.data.revealAll': 'Alle anzeigen',
    'detail.data.hideAll': 'Alle verbergen',
    'detail.data.revealAllAria': 'Alle Werte anzeigen',
    'detail.data.toggleAria': 'Wert umschalten',
    'detail.data.reveal': 'Anzeigen',
    'detail.data.hide': 'Verbergen',
    'detail.data.col.key': 'Key',
    'detail.data.col.value': 'Wert',
    'detail.data.base64Decoded': '(base64-dekodiert)',

    // Node overview
    'detail.node.capacity': 'Kapazität',
    'detail.node.resource': 'Ressource',
    'detail.node.capacityCol': 'Capacity',
    'detail.node.allocatable': 'Allocatable',
    'detail.node.system': 'System',
    'detail.node.kubeletVersion': 'Kubelet-Version',
    'detail.node.osImage': 'OS-Image',
    'detail.node.containerRuntime': 'Container-Runtime',
    'detail.node.addresses': 'Adressen',
    'detail.node.taints': 'Taints',

    // YAML code
    'detail.yaml.notLoaded': 'Kein YAML geladen.',

    // Resource table
    'detail.table.namespace': 'Namespace',
    'detail.table.empty': 'Keine {{kind}}-Ressourcen gefunden',
  },
};
