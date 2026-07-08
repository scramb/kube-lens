package main

import (
	"context"
	"fmt"
	"io"
	"sync"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// execSession holds the runtime handles for one interactive exec stream.
type execSession struct {
	stdinW *io.PipeWriter
	resize chan remotecommand.TerminalSize
	cancel context.CancelFunc
}

// execRegistry is a package-level registry of active exec sessions.
type execRegistry struct {
	mu       sync.Mutex
	sessions map[string]*execSession
	counter  int
}

var execSessions = &execRegistry{sessions: map[string]*execSession{}}

// add registers a session and returns its generated id (e.g. "exec-1").
func (r *execRegistry) add(s *execSession) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.counter++
	id := fmt.Sprintf("exec-%d", r.counter)
	r.sessions[id] = s
	return id
}

// get returns the session for id, or nil if it does not exist.
func (r *execRegistry) get(id string) *execSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sessions[id]
}

// remove deletes a session from the registry. Safe to call multiple times.
func (r *execRegistry) remove(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.sessions, id)
}

// termSizeQueue implements remotecommand.TerminalSizeQueue.
type termSizeQueue struct {
	ch chan remotecommand.TerminalSize
}

func (q *termSizeQueue) Next() *remotecommand.TerminalSize {
	s, ok := <-q.ch
	if !ok {
		return nil
	}
	return &s
}

// execEmitter is an io.Writer that forwards written bytes to the frontend as a
// Wails event.
type execEmitter struct {
	app   *App
	event string
}

func (e *execEmitter) Write(p []byte) (int, error) {
	wailsruntime.EventsEmit(e.app.ctx, e.event, string(p))
	return len(p), nil
}

// StartExec opens an interactive exec stream into the given container and
// returns the exec session id. stdout/stderr are emitted as "exec:data:<id>"
// events; termination is signalled via an "exec:end:<id>" event.
func (a *App) StartExec(namespace, pod, container, shell string) (string, error) {
	_, _, restConfig, err := a.kube.clients()
	if err != nil {
		return "", err
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}

	if shell == "" {
		shell = "/bin/sh"
	}

	pr, pw := io.Pipe()
	resize := make(chan remotecommand.TerminalSize, 1)
	ctx, cancel := context.WithCancel(context.Background())

	sess := &execSession{
		stdinW: pw,
		resize: resize,
		cancel: cancel,
	}
	execID := execSessions.add(sess)

	req := clientset.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(pod).
		Namespace(namespace).
		SubResource("exec")
	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   []string{shell},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		cancel()
		execSessions.remove(execID)
		_ = pr.Close()
		_ = pw.Close()
		return "", err
	}

	dataEvent := "exec:data:" + execID
	endEvent := "exec:end:" + execID

	go func() {
		streamErr := exec.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             pr,
			Stdout:            &execEmitter{app: a, event: dataEvent},
			Stderr:            &execEmitter{app: a, event: dataEvent},
			Tty:               true,
			TerminalSizeQueue: &termSizeQueue{ch: resize},
		})

		errStr := ""
		if streamErr != nil {
			errStr = streamErr.Error()
		}
		wailsruntime.EventsEmit(a.ctx, endEvent, errStr)

		// Cleanup: cancel context, drop from registry, close pipes.
		cancel()
		execSessions.remove(execID)
		_ = pr.Close()
		_ = pw.Close()
	}()

	return execID, nil
}

// ExecWrite forwards keyboard input from the frontend into the exec stdin.
func (a *App) ExecWrite(execID, data string) {
	sess := execSessions.get(execID)
	if sess == nil || sess.stdinW == nil {
		return
	}
	if _, err := sess.stdinW.Write([]byte(data)); err != nil {
		wailsruntime.LogWarningf(a.ctx, "exec write failed for %s: %v", execID, err)
	}
}

// ExecResize updates the pseudo-terminal size for an exec session. The write is
// non-blocking so a full channel simply drops the update.
func (a *App) ExecResize(execID string, cols, rows int) {
	sess := execSessions.get(execID)
	if sess == nil || sess.resize == nil {
		return
	}
	select {
	case sess.resize <- remotecommand.TerminalSize{Width: uint16(cols), Height: uint16(rows)}:
	default:
	}
}

// StopExec tears down an exec session: it cancels the stream context, closes
// stdin, and removes the session from the registry.
func (a *App) StopExec(execID string) {
	sess := execSessions.get(execID)
	if sess == nil {
		return
	}
	if sess.cancel != nil {
		sess.cancel()
	}
	if sess.stdinW != nil {
		_ = sess.stdinW.Close()
	}
	execSessions.remove(execID)
}
