-- Migration 000012: Add User Management Tables
-- Creates users, permissions, and roles tables for authentication and authorization

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP,
    CONSTRAINT users_username_org_unique UNIQUE (username, organization_id),
    CONSTRAINT users_email_org_unique UNIQUE (email, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT permissions_role_resource_action_unique UNIQUE (role, resource, action, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_organization_id ON permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- Create roles table for custom role definitions
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_name_org_unique UNIQUE (name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON roles(is_system);

-- Insert default permissions for admin role
INSERT INTO permissions (role, resource, action, organization_id) VALUES
    ('admin', 'volumes', 'read', NULL),
    ('admin', 'volumes', 'write', NULL),
    ('admin', 'volumes', 'delete', NULL),
    ('admin', 'scans', 'read', NULL),
    ('admin', 'scans', 'write', NULL),
    ('admin', 'scans', 'delete', NULL),
    ('admin', 'files', 'read', NULL),
    ('admin', 'files', 'write', NULL),
    ('admin', 'files', 'delete', NULL),
    ('admin', 'users', 'read', NULL),
    ('admin', 'users', 'write', NULL),
    ('admin', 'users', 'delete', NULL),
    ('admin', 'organizations', 'read', NULL),
    ('admin', 'organizations', 'write', NULL),
    ('admin', 'organizations', 'delete', NULL)
ON CONFLICT (role, resource, action, organization_id) DO NOTHING;

-- Insert default permissions for user role
INSERT INTO permissions (role, resource, action, organization_id) VALUES
    ('user', 'volumes', 'read', NULL),
    ('user', 'scans', 'read', NULL),
    ('user', 'scans', 'write', NULL),
    ('user', 'files', 'read', NULL)
ON CONFLICT (role, resource, action, organization_id) DO NOTHING;

-- Insert default permissions for viewer role
INSERT INTO permissions (role, resource, action, organization_id) VALUES
    ('viewer', 'volumes', 'read', NULL),
    ('viewer', 'scans', 'read', NULL),
    ('viewer', 'files', 'read', NULL)
ON CONFLICT (role, resource, action, organization_id) DO NOTHING;
