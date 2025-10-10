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

// Organization-related aliases
type Organization = sqlc.Organizations
type OrganizationInvitation = sqlc.OrganizationInvitations

// Permission-related aliases
type Permission = sqlc.Permissions
type Role = sqlc.Roles

// Audit-related aliases
type AuditLog = sqlc.AuditLogs

// User query param aliases
type CreateUserParams = sqlc.CreateUserParams
type UpdateUserParams = sqlc.UpdateUserParams
type UpdateUserPasswordParams = sqlc.UpdateUserPasswordParams
type ListUsersParams = sqlc.ListUsersByOrgParams
type GetUserByIDAndOrgParams = sqlc.GetUserByIDAndOrgParams
type GetUserByUsernameAndOrgParams = sqlc.GetUserByUsernameAndOrgParams
type GetUserByEmailAndOrgParams = sqlc.GetUserByEmailAndOrgParams
type DeleteUserByUsernameAndOrgParams = sqlc.DeleteUserByUsernameAndOrgParams
type SetUserActiveParams = sqlc.SetUserActiveParams
type CountUsersByOrgParams = int64
type ListAllUsersParams = sqlc.ListAllUsersParams

// Permission query param aliases
type CreatePermissionParams = sqlc.CreatePermissionParams
type GetRolePermissionsParams = sqlc.GetRolePermissionsParams
type CheckRolePermissionParams = sqlc.CheckRolePermissionParams
type DeleteRolePermissionsParams = sqlc.DeleteRolePermissionsParams
type CreateRoleParams = sqlc.CreateRoleParams
type GetRoleByNameParams = sqlc.GetRoleByNameParams
type UpdateRoleParams = sqlc.UpdateRoleParams

// Organization invitation query param aliases
type CreateInvitationParams = sqlc.CreateInvitationParams
type GetInvitationByTokenParams = string
type ListInvitationsByOrgParams = sqlc.ListInvitationsByOrgParams
type UpdateInvitationStatusParams = sqlc.UpdateInvitationStatusParams

// Audit log query param aliases
type CreateAuditLogParams = sqlc.CreateAuditLogParams
type ListAuditLogsByOrgParams = sqlc.ListAuditLogsByOrgParams
type ListAuditLogsByUserParams = sqlc.ListAuditLogsByUserParams
type ListAuditLogsByActionParams = sqlc.ListAuditLogsByActionParams
type ListAuditLogsByResourceParams = sqlc.ListAuditLogsByResourceParams
