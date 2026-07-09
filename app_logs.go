package main

import (
	"bufio"
	"context"
	"fmt"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ---------- Types exposed to the frontend ----------

type LogStreamOptions struct {
	Container    string `json:"container"`
	TailLines    int64  `json:"tailLines"`
	Previous     bool   `json:"previous"`
	Timestamps   bool   `json:"timestamps"`
	SinceSeconds int64  `json:"sinceSeconds"`
}

// ---------- Stream registry ----------

// logStreamRegistry tracks the cancel functions of all running log streams so
// they can be torn down individually via StopPodLogs.
type logStreamRegistry struct {
	mu      sync.Mutex
	cancels map[string]context.CancelFunc
	counter int
}

var logStreams = &logStreamRegistry{cancels: map[string]context.CancelFunc{}}

func (r *logStreamRegistry) add(cancel context.CancelFunc) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.counter++
	id := fmt.Sprintf("logstream-%d", r.counter)
	r.cancels[id] = cancel
	return id
}

func (r *logStreamRegistry) remove(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cancels, id)
}

func (r *logStreamRegistry) stop(id string) {
	r.mu.Lock()
	cancel, ok := r.cancels[id]
	if ok {
		delete(r.cancels, id)
	}
	r.mu.Unlock()
	if ok {
		cancel()
	}
}

// ---------- Bindings ----------

// clientset builds a typed kubernetes clientset from the current cluster's
// rest.Config. The dynamic client used elsewhere cannot serve the pod logs
// subresource, so a typed client is required here.
func (a *App) clientset() (*kubernetes.Clientset, error) {
	_, _, restCfg, err := a.kube.clients()
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(restCfg)
}

// ListPodContainers returns the names of all containers in a pod, init
// containers first, so the frontend can offer a container picker.
func (a *App) ListPodContainers(namespace, pod string) ([]string, error) {
	_, dyn, _, err := a.kube.clients()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	gvr := schema.GroupVersionResource{Version: "v1", Resource: "pods"}
	obj, err := dyn.Resource(gvr).Namespace(namespace).Get(ctx, pod, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	names := []string{}
	names = append(names, containerNames(obj, "initContainers")...)
	names = append(names, containerNames(obj, "containers")...)
	return names, nil
}

func containerNames(obj *unstructured.Unstructured, field string) []string {
	list, found, err := unstructured.NestedSlice(obj.Object, "spec", field)
	if err != nil || !found {
		return nil
	}
	names := make([]string, 0, len(list))
	for _, entry := range list {
		m, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		if name, ok := m["name"].(string); ok && name != "" {
			names = append(names, name)
		}
	}
	return names
}

// StartPodLogs begins following the logs of a pod's container and streams them
// to the frontend as batched events. It returns a stream ID that must be passed
// to StopPodLogs to stop the stream.
//
// Events emitted (all suffixed with the returned stream ID):
//   - "logs:data:<id>"  payload []string  — a batch of log lines
//   - "logs:end:<id>"   payload string    — stream finished ("" or error text)
//   - "logs:error:<id>" payload string    — the stream could not be opened
func (a *App) StartPodLogs(namespace, pod string, opts LogStreamOptions) (string, error) {
	clientset, err := a.clientset()
	if err != nil {
		return "", err
	}

	podLogOptions := &corev1.PodLogOptions{
		Container:  opts.Container,
		Follow:     true,
		Timestamps: opts.Timestamps,
		Previous:   opts.Previous,
	}
	if opts.TailLines > 0 {
		tail := opts.TailLines
		podLogOptions.TailLines = &tail
	}
	if opts.SinceSeconds > 0 {
		since := opts.SinceSeconds
		podLogOptions.SinceSeconds = &since
	}

	req := clientset.CoreV1().Pods(namespace).GetLogs(pod, podLogOptions)

	ctx, cancel := context.WithCancel(context.Background())
	streamID := logStreams.add(cancel)

	go a.pumpLogs(ctx, req, streamID)

	return streamID, nil
}

func (a *App) pumpLogs(ctx context.Context, req *rest.Request, streamID string) {
	defer logStreams.remove(streamID)

	stream, err := req.Stream(ctx)
	if err != nil {
		a.emit("logs:error:"+streamID, err.Error())
		return
	}
	defer stream.Close()

	scanner := bufio.NewScanner(stream)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	batch := make([]string, 0, 64)
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		out := make([]string, len(batch))
		copy(out, batch)
		a.emit("logs:data:"+streamID, out)
		batch = batch[:0]
	}

	lines := make(chan string)
	scanErr := make(chan error, 1)
	go func() {
		for scanner.Scan() {
			select {
			case lines <- scanner.Text():
			case <-ctx.Done():
				return
			}
		}
		scanErr <- scanner.Err()
	}()

	for {
		select {
		case <-ctx.Done():
			flush()
			a.emit("logs:end:"+streamID, "")
			return
		case line := <-lines:
			batch = append(batch, line)
			if len(batch) >= 50 {
				flush()
			}
		case <-ticker.C:
			flush()
		case err := <-scanErr:
			flush()
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			a.emit("logs:end:"+streamID, msg)
			return
		}
	}
}

// StopPodLogs cancels a running log stream and removes it from the registry.
func (a *App) StopPodLogs(streamID string) {
	logStreams.stop(streamID)
}
