package main

// Flux binding surface for the frontend.

func (a *App) FluxStatus() ([]FluxKindStatus, error) {
	return a.kube.FluxStatus()
}

func (a *App) FluxSuspendedResources() ([]FluxProblemResource, error) {
	return a.kube.FluxSuspendedResources()
}

func (a *App) GetFluxOwnership(group, version, resource, namespace, name string) (FluxOwnership, error) {
	return a.kube.GetFluxOwnership(group, version, resource, namespace, name)
}

func (a *App) FluxReconcile(group, version, resource, namespace, name string) error {
	return a.kube.FluxReconcile(group, version, resource, namespace, name)
}

func (a *App) FluxReconcileWithSource(group, version, resource, namespace, name string) error {
	return a.kube.FluxReconcileWithSource(group, version, resource, namespace, name)
}
