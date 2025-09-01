package store

import (
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Type aliases for SQLC-generated types to provide a stable store API
// This bridges the gap between the store interface and SQLC implementation

// Table model aliases (only include types that exist in current SQLC generation)
type UsageSnapshot = sqlc.UsageSnapshots
type Volume = sqlc.Volumes
type DailyStatsRow = sqlc.DailyStats
type VolumeSizeRow = sqlc.VolumeSizes

// Docker-related aliases
type DockerMountCatalogRow = sqlc.DockerMountCatalog
type DockerMountAttachmentsRow = sqlc.DockerMountAttachments

// File-related aliases  
type FileRecord = sqlc.Files
type FileMetadataRow = sqlc.FileMetadata
type FolderRow = sqlc.Folders

// User-related aliases
type User = sqlc.Users
type UserSession = sqlc.UserSessions
type UserActivityLogRow = sqlc.UserActivityLog
type UserPreference = sqlc.UserPreferences

// Organization-related aliases
type Organization = sqlc.Organizations
type OrganizationInvitation = sqlc.OrganizationInvitations

// User query param aliases
type CreateUserParams = sqlc.CreateUserParams
type UpdateUserParams = sqlc.UpdateUserParams
type UpdateUserPasswordParams = sqlc.UpdateUserPasswordParams
type CreateUserSessionParams = sqlc.CreateUserSessionParams
type LogUserActivityParams = sqlc.LogUserActivityParams
type SetUserPreferenceParams = sqlc.SetUserPreferenceParams
type LockUserParams = sqlc.LockUserParams
type SetPasswordResetTokenParams = sqlc.SetPasswordResetTokenParams
type GetUserActivityLogParams = sqlc.GetUserActivityLogParams
type GetUserPreferenceParams = sqlc.GetUserPreferenceParams
type DeleteUserPreferenceParams = sqlc.DeleteUserPreferenceParams
type ListUsersParams = sqlc.ListUsersParams

// User enum aliases
type UserRole = sqlc.UserRole
type UserStatus = sqlc.UserStatus

// TODO: Add other type aliases as needed when SQLC queries are implemented