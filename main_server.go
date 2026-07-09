//go:build server

package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	serverMode := flag.Bool("server", true, "run as browser-accessible HTTP server")
	addr := flag.String("addr", "127.0.0.1:8399", "HTTP listen address")
	authToken := flag.String("auth-token", os.Getenv("KUBE_LENS_AUTH_TOKEN"), "Bearer token for API access")
	enableLocalTerminal := flag.Bool("enable-local-terminal", false, "enable container-local shell terminals")
	flag.Parse()

	ensureToolPath()
	if !*serverMode {
		fmt.Fprintln(os.Stderr, "desktop mode is not available in a -tags server build")
		os.Exit(2)
	}
	app := NewApp()
	if err := runServer(app, serverOptions{Addr: *addr, AuthToken: *authToken, EnableLocalTerminal: *enableLocalTerminal}); err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}
