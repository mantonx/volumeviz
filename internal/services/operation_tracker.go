package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/mantonx/volumeviz/internal/models"
)

// OperationTracker manages file operation tracking and rollback
type OperationTracker struct {
	backupDir string
}

// NewOperationTracker creates a new operation tracker
func NewOperationTracker(backupDir string) *OperationTracker {
	return &OperationTracker{
		backupDir: backupDir,
	}
}

// CreateOperation creates and tracks a new operation
func (ot *OperationTracker) CreateOperation(ctx context.Context, opType models.OperationType, volumeID, description string) (*models.Operation, error) {
	operation := &models.Operation{
		ID:          "op-" + uuid.New().String(),
		Type:        opType,
		Status:      models.OperationStatusPending,
		VolumeID:    volumeID,
		Description: description,
		CreatedAt:   time.Now(),
		Actions:     make([]models.OperationAction, 0),
		Metadata: models.OperationMetadata{
			TotalFiles:     0,
			ProcessedFiles: 0,
		},
	}

	return operation, nil
}

// AddAction adds an action to an operation and creates backup if needed
func (ot *OperationTracker) AddAction(ctx context.Context, operation *models.Operation, action models.OperationAction) error {
	action.ID = "action-" + uuid.New().String()

	// Create backup for delete operations
	if action.Type == models.OperationTypeDelete {
		backupPath, err := ot.createBackup(action.SourcePath)
		if err != nil {
			return fmt.Errorf("failed to create backup for %s: %w", action.SourcePath, err)
		}
		action.BackupPath = backupPath
	}

	operation.Actions = append(operation.Actions, action)
	operation.Metadata.TotalFiles = len(operation.Actions)

	return nil
}

// ExecuteAction executes a single action within an operation
func (ot *OperationTracker) ExecuteAction(ctx context.Context, operation *models.Operation, actionID string) error {
	// Find the action
	actionIndex := -1
	for i, action := range operation.Actions {
		if action.ID == actionID {
			actionIndex = i
			break
		}
	}

	if actionIndex == -1 {
		return fmt.Errorf("action %s not found", actionID)
	}

	action := &operation.Actions[actionIndex]

	// Execute the action based on type
	var err error
	switch action.Type {
	case models.OperationTypeDelete:
		err = ot.executeDelete(action)
	case models.OperationTypeMove:
		err = ot.executeMove(action)
	case models.OperationTypeCopy:
		err = ot.executeCopy(action)
	case models.OperationTypeRename:
		err = ot.executeRename(action)
	default:
		err = fmt.Errorf("unsupported operation type: %s", action.Type)
	}

	// Update action status
	now := time.Now()
	action.ExecutedAt = &now

	if err != nil {
		action.Status = "failed"
		action.ErrorMessage = err.Error()
		return err
	}

	action.Status = "completed"
	operation.Metadata.ProcessedFiles++

	return nil
}

// CompleteOperation marks an operation as completed
func (ot *OperationTracker) CompleteOperation(operation *models.Operation) {
	now := time.Now()
	operation.CompletedAt = &now
	operation.Status = models.OperationStatusCompleted
}

// RollbackOperation rolls back an entire operation or specific actions
func (ot *OperationTracker) RollbackOperation(ctx context.Context, operation *models.Operation, actionIDs []string, reason string) (*models.RollbackResponse, error) {
	response := &models.RollbackResponse{
		Success:     true,
		RolledBack:  make([]string, 0),
		Failed:      make([]models.RollbackFailure, 0),
		OperationID: "rollback-op-" + uuid.New().String(),
		CompletedAt: time.Now(),
	}

	// If no specific actions specified, rollback all completed actions
	targetActions := operation.Actions
	if len(actionIDs) > 0 {
		targetActions = make([]models.OperationAction, 0)
		for _, action := range operation.Actions {
			for _, targetID := range actionIDs {
				if action.ID == targetID {
					targetActions = append(targetActions, action)
					break
				}
			}
		}
	}

	// Rollback actions in reverse order
	for i := len(targetActions) - 1; i >= 0; i-- {
		action := targetActions[i]

		if action.Status != "completed" {
			continue // Skip non-completed actions
		}

		err := ot.rollbackAction(&action)
		if err != nil {
			response.Failed = append(response.Failed, models.RollbackFailure{
				ActionID:     action.ID,
				ErrorMessage: err.Error(),
				Reason:       "rollback_failed",
			})
			response.Success = false
		} else {
			response.RolledBack = append(response.RolledBack, action.ID)
		}
	}

	// Update operation status if all actions rolled back
	if len(response.Failed) == 0 && len(actionIDs) == 0 {
		operation.Status = models.OperationStatusRolledBack
	}

	return response, nil
}

// createBackup creates a backup copy of a file before operation
func (ot *OperationTracker) createBackup(filePath string) (string, error) {
	// Ensure backup directory exists
	if err := os.MkdirAll(ot.backupDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create backup directory: %w", err)
	}

	// Generate unique backup filename
	filename := filepath.Base(filePath)
	backupName := fmt.Sprintf("%d_%s_%s", time.Now().Unix(), uuid.New().String()[:8], filename)
	backupPath := filepath.Join(ot.backupDir, backupName)

	// Copy file to backup location
	source, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open source file: %w", err)
	}
	defer source.Close()

	backup, err := os.Create(backupPath)
	if err != nil {
		return "", fmt.Errorf("failed to create backup file: %w", err)
	}
	defer backup.Close()

	_, err = io.Copy(backup, source)
	if err != nil {
		os.Remove(backupPath) // Clean up failed backup
		return "", fmt.Errorf("failed to copy file to backup: %w", err)
	}

	return backupPath, nil
}

// executeDelete performs file deletion
func (ot *OperationTracker) executeDelete(action *models.OperationAction) error {
	return os.Remove(action.SourcePath)
}

// executeMove performs file move operation
func (ot *OperationTracker) executeMove(action *models.OperationAction) error {
	// Create target directory if it doesn't exist
	targetDir := filepath.Dir(action.TargetPath)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory: %w", err)
	}

	return os.Rename(action.SourcePath, action.TargetPath)
}

// executeCopy performs file copy operation
func (ot *OperationTracker) executeCopy(action *models.OperationAction) error {
	// Create target directory if it doesn't exist
	targetDir := filepath.Dir(action.TargetPath)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory: %w", err)
	}

	source, err := os.Open(action.SourcePath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer source.Close()

	target, err := os.Create(action.TargetPath)
	if err != nil {
		return fmt.Errorf("failed to create target file: %w", err)
	}
	defer target.Close()

	_, err = io.Copy(target, source)
	return err
}

// executeRename performs file rename operation
func (ot *OperationTracker) executeRename(action *models.OperationAction) error {
	return os.Rename(action.SourcePath, action.TargetPath)
}

// rollbackAction rolls back a specific action
func (ot *OperationTracker) rollbackAction(action *models.OperationAction) error {
	switch action.Type {
	case models.OperationTypeDelete:
		return ot.rollbackDelete(action)
	case models.OperationTypeMove:
		return ot.rollbackMove(action)
	case models.OperationTypeCopy:
		return ot.rollbackCopy(action)
	case models.OperationTypeRename:
		return ot.rollbackRename(action)
	default:
		return fmt.Errorf("unsupported rollback for operation type: %s", action.Type)
	}
}

// rollbackDelete restores a deleted file from backup
func (ot *OperationTracker) rollbackDelete(action *models.OperationAction) error {
	if action.BackupPath == "" {
		return fmt.Errorf("no backup path available for rollback")
	}

	// Check if backup exists
	if _, err := os.Stat(action.BackupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file no longer exists: %s", action.BackupPath)
	}

	// Create target directory if needed
	targetDir := filepath.Dir(action.SourcePath)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory: %w", err)
	}

	// Copy backup back to original location
	backup, err := os.Open(action.BackupPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer backup.Close()

	restored, err := os.Create(action.SourcePath)
	if err != nil {
		return fmt.Errorf("failed to create restored file: %w", err)
	}
	defer restored.Close()

	_, err = io.Copy(restored, backup)
	if err != nil {
		return fmt.Errorf("failed to restore file from backup: %w", err)
	}

	// Clean up backup file
	os.Remove(action.BackupPath)
	return nil
}

// rollbackMove reverses a move operation
func (ot *OperationTracker) rollbackMove(action *models.OperationAction) error {
	return os.Rename(action.TargetPath, action.SourcePath)
}

// rollbackCopy removes the copied file
func (ot *OperationTracker) rollbackCopy(action *models.OperationAction) error {
	return os.Remove(action.TargetPath)
}

// rollbackRename reverses a rename operation
func (ot *OperationTracker) rollbackRename(action *models.OperationAction) error {
	return os.Rename(action.TargetPath, action.SourcePath)
}

// GetOperationHistory retrieves operation history with pagination
func (ot *OperationTracker) GetOperationHistory(ctx context.Context, volumeID string, page, pageSize int) (*models.OperationHistory, error) {
	// In a real implementation, this would query the database
	// For now, return empty result
	return &models.OperationHistory{
		Operations: make([]models.Operation, 0),
		Pagination: models.PaginationResponse{
			Page:     page,
			PageSize: pageSize,
			Total:    0,
			Pages:    0,
		},
	}, nil
}

// CleanupBackups removes old backup files based on retention policy
func (ot *OperationTracker) CleanupBackups(ctx context.Context, retentionDays int) error {
	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)

	return filepath.Walk(ot.backupDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && info.ModTime().Before(cutoffTime) {
			return os.Remove(path)
		}

		return nil
	})
}