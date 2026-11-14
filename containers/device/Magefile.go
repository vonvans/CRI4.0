//go:build mage
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Default target to run
var Default = Build

// Build compiles all the industrial components for Linux/AMD64 (Docker friendly)
func Build() error {
	fmt.Println("Compiling components...")
	apps := []string{"physics-sim", "temp-sensor", "valve-actuator", "mock-plc"}

	for _, app := range apps {
		fmt.Printf("Building %s...\n", app)
		cmd := exec.Command("go", "build",
			"-o", filepath.Join("bin", app),
			"-trimpath",
			"-ldflags", "-s -w",
			filepath.Join("cmd", app, "main.go"))
		
		cmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH=amd64", "CGO_ENABLED=0")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to build %s: %w", app, err)
		}
	}
	fmt.Println("Build completed successfully! Binaries are in ./bin")
	return nil
}

// Clean removes compiled binaries
func Clean() error {
	fmt.Println("Cleaning bin folder...")
	return os.RemoveAll("bin")
}

// Docker build space
func Docker() error {
	fmt.Println("Not implemented yet")
	// We can automate "docker build" commands here
	return nil
}
