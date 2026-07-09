//go:build !server

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

func main() {
	serverMode := flag.Bool("server", false, "run as browser-accessible HTTP server")
	addr := flag.String("addr", "127.0.0.1:8399", "HTTP listen address for --server")
	authToken := flag.String("auth-token", os.Getenv("KUBE_LENS_AUTH_TOKEN"), "Bearer token for --server API access")
	enableLocalTerminal := flag.Bool("enable-local-terminal", false, "enable container-local shell terminals in --server mode")
	flag.Parse()

	ensureToolPath()
	app := NewApp()
	if *serverMode {
		if err := runServer(app, serverOptions{Addr: *addr, AuthToken: *authToken, EnableLocalTerminal: *enableLocalTerminal}); err != nil {
			fmt.Fprintln(os.Stderr, "Error:", err)
			os.Exit(1)
		}
		return
	}

	app.setRuntimeMode("desktop", true, true)
	app.setEmitter(wailsEmitter{})
	err := wails.Run(&options.App{
		Title:     "Kube Lens",
		Width:     1440,
		Height:    900,
		MinWidth:  980,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// Startup-only background before the frontend renders; the app theme is handled by Mantine.
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
	}
}
