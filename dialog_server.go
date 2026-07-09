//go:build server

package main

import (
	"context"
	"errors"
)

func openKubeConfigDialog(context.Context, string) (string, error) {
	return "", errors.New("file dialogs are not available in server mode")
}
