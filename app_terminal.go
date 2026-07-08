package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	pty "github.com/aymanbagabas/go-pty"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

const (
	maxLocalTerminals  = 12
	terminalFlushEvery = 25 * time.Millisecond
	terminalBatchLimit = 4096
)

// LocalTerminalInfo is returned to the frontend after a local terminal starts.
type LocalTerminalInfo struct {
	ID          string `json:"id"`
	Shell       string `json:"shell"`
	ContextName string `json:"contextName"`
}

type localTerminalSession struct {
	pty        pty.Pty
	cmd        *pty.Cmd
	cancel     context.CancelFunc
	tempConfig string
	shell      string
	context    string
}

type localTerminalRegistry struct {
	mu       sync.Mutex
	sessions map[string]*localTerminalSession
	counter  int
}

var localTerminals = &localTerminalRegistry{sessions: map[string]*localTerminalSession{}}

func (r *localTerminalRegistry) reserve() (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.sessions) >= maxLocalTerminals {
		return "", fmt.Errorf("maximum number of terminals reached (%d)", maxLocalTerminals)
	}
	r.counter++
	return "term-" + strconv.Itoa(r.counter), nil
}

func (r *localTerminalRegistry) add(id string, s *localTerminalSession) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[id] = s
}

func (r *localTerminalRegistry) get(id string) *localTerminalSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sessions[id]
}

func (r *localTerminalRegistry) remove(id string) *localTerminalSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := r.sessions[id]
	delete(r.sessions, id)
	return s
}

func (r *localTerminalRegistry) stopAll() {
	r.mu.Lock()
	ids := make([]string, 0, len(r.sessions))
	for id := range r.sessions {
		ids = append(ids, id)
	}
	r.mu.Unlock()
	for _, id := range ids {
		stopLocalTerminalByID(id)
	}
}

func tempKubeConfigPath(id string) (string, error) {
	dir := filepath.Join(os.TempDir(), "kube-lens")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, id+".yaml"), nil
}

func (m *KubeManager) writeFlattenedKubeConfigForContext(contextName, id string) (string, error) {
	m.mu.Lock()
	rules := m.loadingRules()
	m.mu.Unlock()

	cfg, err := rules.Load()
	if err != nil {
		return "", fmt.Errorf("could not load kubeconfig: %w", err)
	}
	if _, ok := cfg.Contexts[contextName]; !ok {
		return "", fmt.Errorf("context %q not found", contextName)
	}
	cfg.CurrentContext = contextName
	if err := clientcmdapi.FlattenConfig(cfg); err != nil {
		return "", fmt.Errorf("could not flatten kubeconfig: %w", err)
	}
	path, err := tempKubeConfigPath(id)
	if err != nil {
		return "", err
	}
	if err := clientcmd.WriteToFile(*cfg, path); err != nil {
		return "", err
	}
	if err := os.Chmod(path, 0o600); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}

func localShell() (string, []string, string) {
	if runtime.GOOS == "windows" {
		for _, name := range []string{"pwsh.exe", "powershell.exe"} {
			if path, err := lookPath(name); err == nil {
				return path, nil, strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
			}
		}
		return "powershell.exe", nil, "PowerShell"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell, []string{"-l"}, filepath.Base(shell)
	}
	for _, shell := range []string{"/bin/zsh", "/bin/bash", "/bin/sh"} {
		if _, err := os.Stat(shell); err == nil {
			return shell, []string{"-l"}, filepath.Base(shell)
		}
	}
	return "/bin/sh", nil, "sh"
}

func lookPath(file string) (string, error) {
	path := os.Getenv("PATH")
	for _, dir := range filepath.SplitList(path) {
		candidate := filepath.Join(dir, file)
		if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
			return candidate, nil
		}
	}
	return "", os.ErrNotExist
}

func terminalEnv(tempConfig string) []string {
	env := os.Environ()
	set := func(key, value string) {
		prefix := key + "="
		for i, kv := range env {
			if strings.EqualFold(strings.SplitN(kv, "=", 2)[0], key) {
				env[i] = prefix + value
				return
			}
		}
		env = append(env, prefix+value)
	}
	set("KUBECONFIG", tempConfig)
	set("TERM", "xterm-256color")
	return env
}

func homeDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return os.TempDir()
	}
	return home
}

// StartLocalTerminal starts a local shell attached to a PTY. The shell receives a
// temporary flattened kubeconfig through KUBECONFIG, pinned to contextName.
func (a *App) StartLocalTerminal(contextName string) (LocalTerminalInfo, error) {
	if strings.TrimSpace(contextName) == "" {
		return LocalTerminalInfo{}, errors.New("no Kubernetes context selected")
	}

	id, err := localTerminals.reserve()
	if err != nil {
		return LocalTerminalInfo{}, err
	}

	tempConfig, err := a.kube.writeFlattenedKubeConfigForContext(contextName, id)
	if err != nil {
		return LocalTerminalInfo{}, err
	}

	pt, err := pty.New()
	if err != nil {
		_ = os.Remove(tempConfig)
		return LocalTerminalInfo{}, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	shellPath, shellArgs, shellLabel := localShell()
	cmd := pt.CommandContext(ctx, shellPath, shellArgs...)
	cmd.Dir = homeDir()
	cmd.Env = terminalEnv(tempConfig)

	if err := cmd.Start(); err != nil {
		cancel()
		_ = pt.Close()
		_ = os.Remove(tempConfig)
		return LocalTerminalInfo{}, err
	}

	sess := &localTerminalSession{
		pty:        pt,
		cmd:        cmd,
		cancel:     cancel,
		tempConfig: tempConfig,
		shell:      shellLabel,
		context:    contextName,
	}
	localTerminals.add(id, sess)

	go a.pumpLocalTerminal(id, sess)

	return LocalTerminalInfo{ID: id, Shell: shellLabel, ContextName: contextName}, nil
}

func (a *App) pumpLocalTerminal(id string, sess *localTerminalSession) {
	dataEvent := "term:data:" + id
	endEvent := "term:end:" + id
	chunks := make(chan []byte, 16)
	readErr := make(chan error, 1)
	waitErr := make(chan error, 1)
	done := make(chan struct{})
	defer close(done)

	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := sess.pty.Read(buf)
			if n > 0 {
				chunk := make([]byte, n)
				copy(chunk, buf[:n])
				select {
				case chunks <- chunk:
				case <-done:
					return
				}
			}
			if err != nil {
				select {
				case readErr <- err:
				case <-done:
				}
				return
			}
		}
	}()

	go func() { waitErr <- sess.cmd.Wait() }()

	ticker := time.NewTicker(terminalFlushEvery)
	defer ticker.Stop()
	var pending []byte
	flush := func() {
		if len(pending) == 0 {
			return
		}
		wailsruntime.EventsEmit(a.ctx, dataEvent, string(pending))
		pending = pending[:0]
	}

	endMsg := ""
	for {
		select {
		case chunk := <-chunks:
			pending = append(pending, chunk...)
			if len(pending) >= terminalBatchLimit {
				flush()
			}
		case <-ticker.C:
			flush()
		case err := <-readErr:
			if err != nil && !errors.Is(err, io.EOF) && endMsg == "" {
				endMsg = err.Error()
			}
		case err := <-waitErr:
			flush()
			if err != nil && endMsg == "" && sess.cancel != nil {
				endMsg = err.Error()
			}
			cleanupLocalTerminal(id, sess)
			wailsruntime.EventsEmit(a.ctx, endEvent, endMsg)
			return
		}
	}
}

func cleanupLocalTerminal(id string, sess *localTerminalSession) {
	localTerminals.remove(id)
	if sess.cancel != nil {
		sess.cancel()
	}
	if sess.pty != nil {
		_ = sess.pty.Close()
	}
	if sess.tempConfig != "" {
		_ = os.Remove(sess.tempConfig)
	}
}

func stopLocalTerminalByID(id string) {
	sess := localTerminals.remove(id)
	if sess == nil {
		return
	}
	if sess.cancel != nil {
		sess.cancel()
	}
	if sess.cmd != nil && sess.cmd.Process != nil {
		_ = sess.cmd.Process.Kill()
	}
	if sess.pty != nil {
		_ = sess.pty.Close()
	}
	if sess.tempConfig != "" {
		_ = os.Remove(sess.tempConfig)
	}
}

// LocalTerminalWrite forwards user input to the local terminal PTY.
func (a *App) LocalTerminalWrite(id, data string) {
	sess := localTerminals.get(id)
	if sess == nil || sess.pty == nil {
		return
	}
	if _, err := sess.pty.Write([]byte(data)); err != nil {
		wailsruntime.LogWarningf(a.ctx, "local terminal write failed for %s: %v", id, err)
	}
}

// LocalTerminalResize resizes the PTY backing a local terminal.
func (a *App) LocalTerminalResize(id string, cols, rows int) {
	if cols <= 0 || rows <= 0 {
		return
	}
	sess := localTerminals.get(id)
	if sess == nil || sess.pty == nil {
		return
	}
	if err := sess.pty.Resize(cols, rows); err != nil {
		wailsruntime.LogWarningf(a.ctx, "local terminal resize failed for %s: %v", id, err)
	}
}

// StopLocalTerminal terminates a local terminal and removes its temporary kubeconfig.
func (a *App) StopLocalTerminal(id string) {
	stopLocalTerminalByID(id)
}

func (a *App) shutdown(ctx context.Context) {
	localTerminals.stopAll()
	resourceWatches.stopAll()
}
