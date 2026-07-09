//go:build !server

package main

import (
	"context"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type wailsEmitter struct{}

func (wailsEmitter) Emit(ctx context.Context, event string, data ...interface{}) {
	wailsruntime.EventsEmit(ctx, event, data...)
}
