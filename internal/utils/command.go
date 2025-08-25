package utils

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"
)

// CommandResult contains the result of a command execution
type CommandResult struct {
	Stdout   []byte
	Stderr   []byte
	ExitCode int
	Duration time.Duration
}

// CommandRunner provides a unified interface for running external commands
type CommandRunner struct {
	ToolName    string
	ToolPath    string
	DefaultArgs []string
	Timeout     time.Duration
}

// NewCommandRunner creates a new command runner
func NewCommandRunner(toolName string, timeout time.Duration) *CommandRunner {
	return &CommandRunner{
		ToolName: toolName,
		Timeout:  timeout,
	}
}

// IsAvailable checks if the tool is available in the system
func (cr *CommandRunner) IsAvailable() bool {
	path, err := exec.LookPath(cr.ToolName)
	if err != nil {
		return false
	}
	cr.ToolPath = path
	return true
}

// RunWithTimeout executes the command with a timeout
func (cr *CommandRunner) RunWithTimeout(ctx context.Context, timeout time.Duration, filePath string, args ...string) (*CommandResult, error) {
	if timeout <= 0 {
		timeout = cr.Timeout
	}

	// Create context with timeout
	cmdCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Build command arguments
	cmdArgs := append(cr.DefaultArgs, args...)
	cmdArgs = append(cmdArgs, filePath)

	// Determine which command to use
	cmdPath := cr.ToolName
	if cr.ToolPath != "" {
		cmdPath = cr.ToolPath
	}

	// Create command
	cmd := exec.CommandContext(cmdCtx, cmdPath, cmdArgs...)

	// Capture output
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Record start time
	start := time.Now()

	// Run command
	err := cmd.Run()
	duration := time.Since(start)

	// Get exit code
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else if cmdCtx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("command timed out after %v", timeout)
		} else {
			return nil, fmt.Errorf("command execution failed: %w", err)
		}
	}

	return &CommandResult{
		Stdout:   stdout.Bytes(),
		Stderr:   stderr.Bytes(),
		ExitCode: exitCode,
		Duration: duration,
	}, nil
}

// Run executes the command with default timeout
func (cr *CommandRunner) Run(ctx context.Context, filePath string, args ...string) (*CommandResult, error) {
	return cr.RunWithTimeout(ctx, cr.Timeout, filePath, args...)
}

// SetDefaultArgs sets default arguments for all command executions
func (cr *CommandRunner) SetDefaultArgs(args []string) {
	cr.DefaultArgs = args
}

// GetToolPath returns the resolved tool path
func (cr *CommandRunner) GetToolPath() string {
	return cr.ToolPath
}
