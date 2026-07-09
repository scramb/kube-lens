package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const rolloutRestartAnnotation = "kubectl.kubernetes.io/restartedAt"

func validateRolloutRestartTarget(group, version, resource string) error {
	if group != "apps" || version != "v1" {
		return fmt.Errorf("rollout restart is only supported for apps/v1 deployments, statefulsets, and daemonsets")
	}
	switch resource {
	case "deployments", "statefulsets", "daemonsets":
		return nil
	default:
		return fmt.Errorf("rollout restart is not supported for resource %q", resource)
	}
}

func validateScaleTarget(group, version, resource string, replicas int) error {
	if replicas < 0 {
		return errors.New("replicas must be greater than or equal to 0")
	}
	if group != "apps" || version != "v1" {
		return fmt.Errorf("scale is only supported for apps/v1 deployments and statefulsets")
	}
	switch resource {
	case "deployments", "statefulsets":
		return nil
	default:
		return fmt.Errorf("scale is not supported for resource %q", resource)
	}
}

func rolloutRestartPatch(timestamp string) (string, error) {
	patch := map[string]any{
		"spec": map[string]any{
			"template": map[string]any{
				"metadata": map[string]any{
					"annotations": map[string]string{
						rolloutRestartAnnotation: timestamp,
					},
				},
			},
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func scalePatch(replicas int) (string, error) {
	patch := map[string]any{
		"spec": map[string]any{
			"replicas": replicas,
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// RolloutRestart triggers the same restart mechanism as `kubectl rollout restart`:
// it updates spec.template.metadata.annotations with a restartedAt timestamp.
func (m *KubeManager) RolloutRestart(group, version, resource, namespace, name string) error {
	if err := validateRolloutRestartTarget(group, version, resource); err != nil {
		return err
	}
	patch, err := rolloutRestartPatch(time.Now().Format(time.RFC3339))
	if err != nil {
		return err
	}
	return m.PatchResource(group, version, resource, namespace, name, patch, "merge")
}

// ScaleResource updates spec.replicas via a merge patch.
func (m *KubeManager) ScaleResource(group, version, resource, namespace, name string, replicas int) error {
	if err := validateScaleTarget(group, version, resource, replicas); err != nil {
		return err
	}
	patch, err := scalePatch(replicas)
	if err != nil {
		return err
	}
	return m.PatchResource(group, version, resource, namespace, name, patch, "merge")
}

func (a *App) RolloutRestart(group, version, resource, namespace, name string) error {
	return a.kube.RolloutRestart(group, version, resource, namespace, name)
}

func (a *App) ScaleResource(group, version, resource, namespace, name string, replicas int) error {
	return a.kube.ScaleResource(group, version, resource, namespace, name, replicas)
}
