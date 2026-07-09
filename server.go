package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"reflect"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

type serverOptions struct {
	Addr                string
	AuthToken           string
	EnableLocalTerminal bool
}

type serverEmitter struct {
	hub *eventHub
}

func (e serverEmitter) Emit(_ context.Context, event string, data ...interface{}) {
	if e.hub != nil {
		e.hub.broadcast(event, data...)
	}
}

type eventFrame struct {
	Event string        `json:"event"`
	Data  []interface{} `json:"data"`
}

type eventHub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]struct{}
}

func newEventHub() *eventHub {
	return &eventHub{clients: map[*websocket.Conn]struct{}{}}
}

func (h *eventHub) add(conn *websocket.Conn) {
	h.mu.Lock()
	h.clients[conn] = struct{}{}
	h.mu.Unlock()
}

func (h *eventHub) remove(conn *websocket.Conn) {
	h.mu.Lock()
	delete(h.clients, conn)
	h.mu.Unlock()
	_ = conn.Close()
}

func (h *eventHub) broadcast(event string, data ...interface{}) {
	frame := eventFrame{Event: event, Data: data}
	h.mu.Lock()
	clients := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		clients = append(clients, conn)
	}
	h.mu.Unlock()
	for _, conn := range clients {
		if err := conn.WriteJSON(frame); err != nil {
			h.remove(conn)
		}
	}
}

type callRequest struct {
	Method string            `json:"method"`
	Args   []json.RawMessage `json:"args"`
}

type callResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func runServer(app *App, opts serverOptions) error {
	if opts.Addr == "" {
		opts.Addr = "127.0.0.1:8399"
	}
	if opts.AuthToken == "" && !isLoopbackAddr(opts.Addr) {
		return fmt.Errorf("refusing to bind %s without --auth-token or KUBE_LENS_AUTH_TOKEN", opts.Addr)
	}
	hub := newEventHub()
	app.setRuntimeMode("server", false, opts.EnableLocalTerminal)
	app.setEmitter(serverEmitter{hub: hub})
	app.startup(context.Background())

	frontend, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		return err
	}
	server := &serverRuntime{app: app, opts: opts, hub: hub, files: frontend}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	mux.HandleFunc("/api/call", server.withAuth(server.handleCall))
	mux.HandleFunc("/api/events", server.withAuth(server.handleEvents))
	mux.HandleFunc("/", server.handleStatic)

	log.Printf("kube-lens server listening on http://%s", opts.Addr)
	return http.ListenAndServe(opts.Addr, mux)
}

type serverRuntime struct {
	app   *App
	opts  serverOptions
	hub   *eventHub
	files fs.FS
}

func (s *serverRuntime) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.opts.AuthToken != "" {
			token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			if token == "" {
				token = r.URL.Query().Get("token")
			}
			if subtle.ConstantTimeCompare([]byte(token), []byte(s.opts.AuthToken)) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next(w, r)
	}
}

func (s *serverRuntime) handleCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req callRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeCallError(w, http.StatusBadRequest, err)
		return
	}
	result, err := callAppMethod(s.app, req.Method, req.Args)
	if err != nil {
		writeCallError(w, http.StatusInternalServerError, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(callResponse{Result: result})
}

func (s *serverRuntime) handleEvents(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	s.hub.add(conn)
	defer s.hub.remove(conn)
	for {
		if _, _, err := conn.NextReader(); err != nil {
			return
		}
	}
}

func (s *serverRuntime) handleStatic(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}
	if _, err := fs.Stat(s.files, path); err != nil {
		path = "index.html"
	}
	http.ServeFileFS(w, r, s.files, path)
}

func callAppMethod(app *App, name string, args []json.RawMessage) (interface{}, error) {
	method := reflect.ValueOf(app).MethodByName(name)
	if !method.IsValid() {
		return nil, fmt.Errorf("unknown method %q", name)
	}
	mtype := method.Type()
	if len(args) != mtype.NumIn() {
		return nil, fmt.Errorf("method %s expects %d args, got %d", name, mtype.NumIn(), len(args))
	}
	in := make([]reflect.Value, mtype.NumIn())
	for i := 0; i < mtype.NumIn(); i++ {
		v, err := decodeArg(args[i], mtype.In(i))
		if err != nil {
			return nil, fmt.Errorf("argument %d: %w", i+1, err)
		}
		in[i] = v
	}
	out := method.Call(in)
	if len(out) > 0 {
		last := out[len(out)-1]
		if last.Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) && !last.IsNil() {
			return nil, last.Interface().(error)
		}
	}
	if len(out) == 0 {
		return nil, nil
	}
	if len(out) == 1 {
		if out[0].Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) {
			return nil, nil
		}
		return out[0].Interface(), nil
	}
	return out[0].Interface(), nil
}

func decodeArg(raw json.RawMessage, typ reflect.Type) (reflect.Value, error) {
	value := reflect.New(typ)
	if len(raw) == 0 {
		return reflect.Zero(typ), nil
	}
	if err := json.Unmarshal(raw, value.Interface()); err != nil {
		return reflect.Value{}, err
	}
	return value.Elem(), nil
}

func writeCallError(w http.ResponseWriter, status int, err error) {
	if err == nil {
		err = errors.New("unknown error")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(callResponse{Error: err.Error()})
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
