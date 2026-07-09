package main

import (
	"context"
	"strconv"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
)

// watchDebounceInterval bestimmt, wie oft höchstens ein "changed"-Event
// emittiert wird, während sich Ressourcen ändern. Verhindert Event-Fluten bei
// vielen schnell aufeinanderfolgenden Watch-Events (z.B. Rollouts).
const watchDebounceInterval = 2 * time.Second

// watchBackoffInterval ist die Pause vor einem Reconnect nach Fehler oder
// Kanal-Schluss. Der Reconnect startet einen frischen Watch ohne
// resourceVersion und behandelt so auch "410 Gone" transparent.
const watchBackoffInterval = 2 * time.Second

// watchRegistry hält die aktiven Watches und ihre Cancel-Funktionen. Sie ist
// package-level, damit die App-Struct unverändert bleibt.
type watchRegistry struct {
	mu      sync.Mutex
	cancels map[string]context.CancelFunc
	counter int
}

var resourceWatches = &watchRegistry{cancels: map[string]context.CancelFunc{}}

// add registriert eine Cancel-Funktion und gibt eine eindeutige Watch-ID zurück.
func (r *watchRegistry) add(cancel context.CancelFunc) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.counter++
	id := "watch-" + strconv.Itoa(r.counter)
	r.cancels[id] = cancel
	return id
}

// stop bricht einen Watch anhand seiner ID ab und entfernt ihn aus der Registry.
func (r *watchRegistry) stop(id string) {
	r.mu.Lock()
	cancel, ok := r.cancels[id]
	if ok {
		delete(r.cancels, id)
	}
	r.mu.Unlock()
	if ok && cancel != nil {
		cancel()
	}
}

// stopAll bricht alle aktiven Watches ab (z.B. beim Kontextwechsel/Shutdown).
func (r *watchRegistry) stopAll() {
	r.mu.Lock()
	cancels := make([]context.CancelFunc, 0, len(r.cancels))
	for id, cancel := range r.cancels {
		cancels = append(cancels, cancel)
		delete(r.cancels, id)
	}
	r.mu.Unlock()
	for _, cancel := range cancels {
		if cancel != nil {
			cancel()
		}
	}
}

// StartResourceWatch startet einen Watch auf die angegebene Ressource und
// emittiert bei Änderungen ein debounced Event "watch:changed:<watchID>".
// Das Frontend lädt daraufhin seine bestehende (Server-Side-)Tabelle neu.
// Ein leerer namespace bedeutet cluster-weit (alle Namespaces).
// Der Rückgabewert watchID wird für StopResourceWatch benötigt.
func (a *App) StartResourceWatch(group, version, resource, namespace string) (string, error) {
	_, dyn, _, err := a.kube.clients()
	if err != nil {
		return "", err
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}

	watchCtx, cancel := context.WithCancel(context.Background())
	watchID := resourceWatches.add(cancel)

	go a.watchLoop(watchCtx, watchID, dyn.Resource(gvr), namespace)

	return watchID, nil
}

// StopResourceWatch stoppt einen zuvor gestarteten Watch und beendet die
// zugehörige goroutine. Ist die ID unbekannt, passiert nichts.
func (a *App) StopResourceWatch(watchID string) {
	resourceWatches.stop(watchID)
}

// watchLoop hält den Watch am Leben: es reconnected mit Backoff bei Fehlern
// oder Kanal-Schluss und emittiert debounced "changed"-Events, bis der Kontext
// abgebrochen wird.
func (a *App) watchLoop(ctx context.Context, watchID string, res dynamic.NamespaceableResourceInterface, namespace string) {
	// Ein leerer namespace bedeutet cluster-weit; dann ohne .Namespace().
	var watcher dynamic.ResourceInterface = res
	if namespace != "" {
		watcher = res.Namespace(namespace)
	}

	// Debounce-Zustand: 'pending' merkt sich, dass seit dem letzten Emit
	// Änderungen aufgelaufen sind. Der Timer feuert am Ende einer Ruhephase
	// und stellt so sicher, dass ein finales Event noch emittiert wird.
	timer := time.NewTimer(watchDebounceInterval)
	if !timer.Stop() {
		<-timer.C
	}
	timerActive := false
	pending := false

	emit := func() {
		a.emit("watch:changed:" + watchID)
	}

	// signal markiert eine Änderung und startet ggf. das Debounce-Fenster.
	signal := func() {
		pending = true
		if !timerActive {
			timer.Reset(watchDebounceInterval)
			timerActive = true
		}
	}

	defer func() {
		if timerActive && !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
	}()

	for {
		// Vor jedem (Re-)Connect prüfen, ob abgebrochen wurde.
		select {
		case <-ctx.Done():
			return
		default:
		}

		w, err := watcher.Watch(ctx, metav1.ListOptions{})
		if err != nil {
			if !sleepOrDone(ctx, watchBackoffInterval) {
				return
			}
			continue
		}

		reconnect := consumeWatch(ctx, w, timer, &timerActive, &pending, signal, emit)
		w.Stop()
		if !reconnect {
			return
		}
		// Kanal geschlossen -> kurze Pause, dann reconnect (frischer Watch).
		if !sleepOrDone(ctx, watchBackoffInterval) {
			return
		}
	}
}

// consumeWatch verarbeitet Events eines einzelnen Watch-Kanals. Rückgabe true
// bedeutet "reconnect nötig" (Kanal geschlossen), false bedeutet "beenden"
// (Kontext abgebrochen).
func consumeWatch(
	ctx context.Context,
	w watch.Interface,
	timer *time.Timer,
	timerActive *bool,
	pending *bool,
	signal func(),
	emit func(),
) bool {
	results := w.ResultChan()
	for {
		select {
		case <-ctx.Done():
			return false
		case ev, ok := <-results:
			if !ok {
				return true
			}
			switch ev.Type {
			case watch.Added, watch.Modified, watch.Deleted:
				signal()
			case watch.Error:
				// Fehler-Event (z.B. 410 Gone): Kanal wird i.d.R. gleich
				// geschlossen; wir behandeln es wie einen Reconnect-Anlass.
				return true
			default:
				// Bookmark u.a. ignorieren.
			}
		case <-timer.C:
			*timerActive = false
			if *pending {
				*pending = false
				emit()
			}
		}
	}
}

// sleepOrDone wartet d lang oder bricht früher ab, wenn der Kontext beendet
// wird. Rückgabe false bedeutet "context cancelled".
func sleepOrDone(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
