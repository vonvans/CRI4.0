//go:build mage
// +build mage

package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

const cmdName = "netproxy"

func executableName() string {
	name := cmdName
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return name
}

func binPath() string {
	return fmt.Sprintf("bin/%s", executableName())
}

func Build() error {
	fullCmdPath := binPath();
	fmt.Printf("Building %s...\n", fullCmdPath)
	
	if err := os.MkdirAll("bin", 0755); err != nil {
		return fmt.Errorf("Cannot create bin folder: %w", err)
	}

	cmd := exec.Command("go", "build", "-o", fullCmdPath, "./cmd/netproxy")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		fmt.Printf("Build error: %v\n", err)
		return err
	}

	fmt.Printf("Build OK: %s\n", fullCmdPath)
	return nil
}

func Run() error {
	if err := Build(); err != nil {
		return err
	}

	fullCmdPath := binPath();
	fmt.Printf("Starting %s...\n", fullCmdPath)
	
	cmd := exec.Command(fullCmdPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return err
	}
	return nil
}

func Clean() error {
	fmt.Println("Cleaning bin/ folder...")
	if err := os.RemoveAll("bin"); err != nil {
		fmt.Printf("Error cleaning bin/: %v\n", err)
		return err
	}
	fmt.Println("Clean done")
	return nil
}
