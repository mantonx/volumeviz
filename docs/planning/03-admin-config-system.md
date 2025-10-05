# Admin & Configuration System - Gap Analysis & Plan
**Date:** 2025-10-01
**Priority:** HIGH - Enterprise Requirement

---

## 🔍 Current State Analysis

### What EXISTS:

1. **Frontend Settings Page** ✅
   - [SettingsPage.tsx](frontend/src/pages/SettingsPage/SettingsPage.tsx)
   - **Only client-side settings** (theme, refresh interval, feature flags)
   - Uses Jotai atoms (localStorage persistence)
   - **NO server configuration**
   - **NO admin panel**

2. **Backend Config System** ✅
   - [internal/config/config.go](internal/config/config.go)
   - **Environment variables only**
   - Comprehensive config struct (Server, DB, Security, Scan, etc.)
   - **NO runtime configuration**
   - **NO API to update config**
   - **NO database-persisted settings**

3. **Basic Admin Role** ⚠️
   - Permission defined: `organization:admin`
   - **No admin middleware**
   - **No admin-only endpoints**
   - **No admin UI**

### What's MISSING:

❌ **Admin Panel** - No admin interface at all
❌ **System Configuration API** - Can't change settings via UI
❌ **Runtime Config Updates** - Must restart to change settings
❌ **Organization Management UI** - No admin tools for orgs
❌ **User Management Admin** - No admin user CRUD
❌ **System Monitoring Dashboard** - No admin metrics/health view
❌ **Audit Log Viewer** - No UI to view audit events
❌ **License Management** - No licensing system
❌ **Feature Flag Admin** - Backend feature flags are env vars only
❌ **Alert Rule Templates** - No pre-built rule library
❌ **Backup/Restore Admin** - No admin tools for data management
❌ **Email Template Editor** - Email templates hardcoded
❌ **Webhook Testing** - No way to test webhooks from UI
❌ **API Key Management** - No admin UI for API keys
❌ **Rate Limit Config** - Hardcoded, can't adjust per user/org

---

## 🏗️ Required Admin/Config System

### Architecture: 3-Tier System

```
┌─────────────────────────────────────────┐
│  1. Client Settings (Jotai/localStorage) │  ← Already exists
│  - Theme, language, UI preferences      │
│  - Auto-refresh, notifications          │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│  2. Organization Settings (Database)     │  ← MISSING
│  - Org-specific config, quotas          │
│  - Custom alert templates               │
│  - Retention policies                   │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│  3. System Settings (Database + Env)     │  ← MISSING
│  - Global system config                 │
│  - Feature flags, rate limits           │
│  - Email/SMTP, auth providers           │
└─────────────────────────────────────────┘
```

---

## 📋 Detailed Requirements

### 1. System Configuration Management

#### 1.1 System Settings Table

```sql
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,        -- 'email', 'auth', 'storage', 'security'
  key VARCHAR(100) NOT NULL,            -- 'smtp_host', 'saml_enabled'
  value JSONB NOT NULL,                 -- Flexible value storage
  value_type VARCHAR(20) NOT NULL,      -- 'string', 'number', 'boolean', 'json'
  encrypted BOOLEAN DEFAULT FALSE,      -- For secrets like SMTP password
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, key)
);

CREATE INDEX idx_system_settings_category ON system_settings(category);
```

#### 1.2 Organization Settings Table

```sql
CREATE TABLE organization_settings (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  value_type VARCHAR(20) NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, category, key)
);

CREATE INDEX idx_org_settings_org ON organization_settings(organization_id);
```

#### 1.3 User Preferences Table

```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

### 2. Admin Panel Features

#### 2.1 System Admin Dashboard

**Route:** `/admin` (requires system admin role)

**Sections:**
1. **Overview**
   - System health metrics
   - Resource usage (DB size, disk, memory)
   - Active users/sessions
   - Recent errors/warnings
   - License status (if applicable)

2. **Organizations**
   - List all organizations
   - Create/edit/delete orgs
   - View org quotas and usage
   - Manage org admins
   - Org-level settings

3. **Users**
   - List all users (filterable by org)
   - Create/edit/delete users
   - Reset passwords (send email)
   - Manage roles and permissions
   - View user activity
   - Impersonate user (for support)

4. **System Settings**
   - **Email/SMTP**
     - SMTP server config
     - Test email delivery
     - Email templates editor
   - **Authentication**
     - Enable/disable auth methods (JWT, SAML, OAuth)
     - Configure SSO providers
     - Session timeouts
     - MFA enforcement
   - **Security**
     - Rate limiting per endpoint
     - IP allowlist/blocklist
     - CORS origins
     - Security headers
   - **Storage**
     - Retention policies (global defaults)
     - Cleanup schedules
     - Preview storage limits
   - **Scanning**
     - Default scan intervals
     - Concurrency limits
     - Skip patterns
   - **Feature Flags**
     - Enable/disable features globally
     - Beta feature access

5. **Monitoring**
   - Real-time metrics
   - Scan job status
   - Background task queue
   - WebSocket connections
   - Database performance

6. **Audit Logs**
   - Searchable audit log viewer
   - Filter by user, action, resource
   - Export audit logs
   - Compliance reports

7. **API & Integrations**
   - API key management (create, revoke, view usage)
   - Webhook management
   - Alert delivery providers
   - Test integrations

8. **Maintenance**
   - Run database cleanup manually
   - Rebuild indexes
   - Clear caches
   - Export system diagnostics
   - Backup/restore (if implemented)

#### 2.2 Organization Admin Dashboard

**Route:** `/admin/organization` (requires org admin role)

**Sections:**
1. **Org Overview**
   - Org stats (volumes, users, storage)
   - Usage vs quotas
   - Recent activity

2. **Members**
   - List org members
   - Invite users (email)
   - Manage member roles (viewer, editor, admin)
   - Remove members

3. **Settings**
   - Organization profile (name, description)
   - Retention policies (org-specific)
   - Alert templates
   - Custom scan schedules
   - Volume quotas

4. **Billing** (if SaaS)
   - Usage metrics
   - Cost breakdown
   - Invoice history

---

### 3. Backend API Endpoints

#### 3.1 System Settings API

```go
// Admin-only endpoints
GET    /api/v1/admin/settings                    // List all system settings
GET    /api/v1/admin/settings/:category          // Get settings by category
PUT    /api/v1/admin/settings/:category/:key     // Update single setting
POST   /api/v1/admin/settings/bulk               // Bulk update settings
DELETE /api/v1/admin/settings/:category/:key     // Reset to default

// Test endpoints
POST   /api/v1/admin/settings/email/test         // Send test email
POST   /api/v1/admin/settings/webhook/test       // Test webhook delivery
POST   /api/v1/admin/settings/auth/test          // Test SSO connection
```

#### 3.2 Organization Management API

```go
// System admin only
GET    /api/v1/admin/organizations                     // List all orgs
POST   /api/v1/admin/organizations                     // Create org
PUT    /api/v1/admin/organizations/:id                 // Update org
DELETE /api/v1/admin/organizations/:id                 // Delete org
GET    /api/v1/admin/organizations/:id/users           // List org users
POST   /api/v1/admin/organizations/:id/users           // Add user to org
DELETE /api/v1/admin/organizations/:id/users/:userId   // Remove user
PUT    /api/v1/admin/organizations/:id/quotas          // Update quotas

// Org admin endpoints
GET    /api/v1/organizations/me/settings                // Get org settings
PUT    /api/v1/organizations/me/settings                // Update org settings
GET    /api/v1/organizations/me/members                 // List members
POST   /api/v1/organizations/me/members/invite          // Invite member
DELETE /api/v1/organizations/me/members/:userId         // Remove member
PUT    /api/v1/organizations/me/members/:userId/role    // Update member role
```

#### 3.3 User Management API

```go
// Admin only
GET    /api/v1/admin/users                   // List all users
GET    /api/v1/admin/users/:id               // Get user details
POST   /api/v1/admin/users                   // Create user
PUT    /api/v1/admin/users/:id               // Update user
DELETE /api/v1/admin/users/:id               // Delete user
POST   /api/v1/admin/users/:id/reset-password // Send password reset
POST   /api/v1/admin/users/:id/impersonate  // Get impersonation token
PUT    /api/v1/admin/users/:id/role          // Change user role
```

#### 3.4 System Monitoring API

```go
GET    /api/v1/admin/health/detailed          // Detailed health check
GET    /api/v1/admin/metrics                  // Prometheus-style metrics
GET    /api/v1/admin/jobs                     // Background job status
GET    /api/v1/admin/connections              // Active connections
GET    /api/v1/admin/diagnostics              // System diagnostics export
```

#### 3.5 Audit Log API

```go
GET    /api/v1/admin/audit-logs               // List audit logs (paginated)
GET    /api/v1/admin/audit-logs/:id           // Get audit log details
GET    /api/v1/admin/audit-logs/export        // Export audit logs (CSV)
GET    /api/v1/admin/audit-logs/stats         // Audit log statistics
```

---

### 4. Configuration Service (Backend)

#### 4.1 Config Service Interface

```go
package config

type Service interface {
    // System settings
    GetSystemSetting(ctx context.Context, category, key string) (*Setting, error)
    SetSystemSetting(ctx context.Context, category, key string, value interface{}) error
    GetSystemSettings(ctx context.Context, category string) ([]*Setting, error)

    // Organization settings
    GetOrgSetting(ctx context.Context, orgID int, category, key string) (*Setting, error)
    SetOrgSetting(ctx context.Context, orgID int, category, key string, value interface{}) error
    GetOrgSettings(ctx context.Context, orgID int, category string) ([]*Setting, error)

    // With fallback to system defaults
    GetEffectiveSetting(ctx context.Context, orgID int, category, key string) (*Setting, error)

    // Hot reload
    ReloadConfig(ctx context.Context) error
    WatchConfigChanges(ctx context.Context) (<-chan ConfigChange, error)
}

type Setting struct {
    Category    string
    Key         string
    Value       interface{}
    ValueType   string
    Encrypted   bool
    Description string
    UpdatedBy   *int
    UpdatedAt   time.Time
}
```

#### 4.2 Hot Reload Mechanism

```go
// Config watcher - reload config on database changes
type ConfigWatcher struct {
    service *ConfigService
    ticker  *time.Ticker
    done    chan bool
}

func (w *ConfigWatcher) Start(ctx context.Context, interval time.Duration) {
    w.ticker = time.NewTicker(interval)

    for {
        select {
        case <-w.ticker.C:
            // Check for config changes
            w.service.ReloadConfig(ctx)
        case <-w.done:
            return
        }
    }
}
```

---

### 5. Frontend Admin Components

#### 5.1 Admin Layout

```tsx
// frontend/src/pages/Admin/AdminLayout.tsx
<AdminLayout>
  <Sidebar>
    - Dashboard
    - Organizations
    - Users
    - Settings
    - Monitoring
    - Audit Logs
    - API & Integrations
  </Sidebar>

  <MainContent>
    <Outlet /> {/* Nested admin routes */}
  </MainContent>
</AdminLayout>
```

#### 5.2 Key Admin Pages

1. **SystemSettingsPage**
   - Tabbed interface (Email, Auth, Security, Storage, Scanning)
   - Form validation
   - Test buttons (send test email, test SSO)
   - Save/Reset buttons
   - Change history

2. **OrganizationsPage**
   - Table with org list
   - Create org modal
   - Edit org drawer
   - Usage charts per org
   - Quota management

3. **UsersPage**
   - Searchable/filterable user table
   - Role badges
   - Quick actions (edit, delete, reset password)
   - User detail modal (activity, permissions)

4. **AuditLogsPage**
   - Advanced search filters
   - Timeline view
   - Export button
   - Drill-down to details

5. **MonitoringPage**
   - Real-time metrics charts
   - Active scans widget
   - System resource gauges
   - Alert status

#### 5.3 Settings Components

```tsx
// Reusable setting input components
<SettingInput
  category="email"
  settingKey="smtp_host"
  label="SMTP Server"
  type="text"
  description="Hostname or IP address of SMTP server"
  required
/>

<SettingInput
  category="email"
  settingKey="smtp_port"
  label="SMTP Port"
  type="number"
  min={1}
  max={65535}
/>

<SettingInput
  category="email"
  settingKey="smtp_password"
  label="SMTP Password"
  type="password"
  encrypted
/>

<SettingToggle
  category="security"
  settingKey="mfa_enforced"
  label="Enforce MFA"
  description="Require all users to enable MFA"
/>
```

---

## 🚀 Implementation Plan

### Phase 1: Core Infrastructure (2-3 weeks)

**Week 1: Backend Foundation**
- [ ] Create database tables (`system_settings`, `organization_settings`, `user_preferences`)
- [ ] Implement Config Service (get/set settings)
- [ ] Add encryption for sensitive values (SMTP passwords, API keys)
- [ ] Create admin middleware (check `organization:admin` permission)
- [ ] Implement hot reload mechanism

**Week 2: System Settings API**
- [ ] Create system settings CRUD endpoints
- [ ] Add validation and schema for each setting category
- [ ] Implement test endpoints (email, webhook, SSO)
- [ ] Add settings audit logging
- [ ] Create settings import/export

**Week 3: Frontend Admin Shell**
- [ ] Create AdminLayout component
- [ ] Build admin navigation sidebar
- [ ] Create admin route guards
- [ ] Build SystemSettingsPage shell
- [ ] Implement settings form with validation

### Phase 2: Admin Features (3-4 weeks)

**Week 4: Organization Management**
- [ ] Organization CRUD API
- [ ] OrganizationsPage component
- [ ] Org member management
- [ ] Quota management UI
- [ ] Org settings page

**Week 5: User Management**
- [ ] User CRUD API (admin)
- [ ] UsersPage component
- [ ] User impersonation flow
- [ ] Password reset admin tool
- [ ] Role assignment UI

**Week 6: Monitoring & Audit**
- [ ] Detailed health check endpoint
- [ ] MonitoringPage component
- [ ] Audit log viewer
- [ ] Export audit logs
- [ ] System diagnostics page

**Week 7: Integrations & Testing**
- [ ] API key management UI
- [ ] Webhook testing tool
- [ ] Email template editor
- [ ] Alert provider configuration
- [ ] Integration tests

### Phase 3: Advanced Features (2-3 weeks)

**Week 8: Feature Flags System**
- [ ] Feature flags table and API
- [ ] Feature flag admin UI
- [ ] Runtime feature toggle
- [ ] Feature usage analytics

**Week 9: License Management (Optional)**
- [ ] License validation service
- [ ] License limits enforcement
- [ ] License admin UI
- [ ] Usage tracking

**Week 10: Polish & Documentation**
- [ ] Admin onboarding guide
- [ ] Setting descriptions/tooltips
- [ ] Keyboard shortcuts
- [ ] Mobile-responsive admin panel
- [ ] Admin user documentation

---

## 🔐 Security Considerations

### Access Control

1. **System Admin Role**
   - Full access to all settings
   - Org and user management
   - System monitoring
   - **Must be separate from org admin**

2. **Organization Admin Role**
   - Org-specific settings only
   - Member management within org
   - Org quotas view (not edit)

3. **Audit Everything**
   - Log all config changes
   - Track who changed what and when
   - Include old and new values

### Encryption

1. **Encrypt Sensitive Settings**
   - SMTP passwords
   - API keys
   - OAuth secrets
   - Encryption at rest in database

2. **Secure Transport**
   - Admin endpoints require HTTPS in production
   - No sensitive data in URL parameters
   - CSRF protection

---

## 📊 Settings Schema Examples

### Email Settings

```json
{
  "category": "email",
  "smtp_host": {
    "value": "smtp.sendgrid.net",
    "type": "string",
    "required": true,
    "description": "SMTP server hostname"
  },
  "smtp_port": {
    "value": 587,
    "type": "number",
    "min": 1,
    "max": 65535,
    "description": "SMTP server port"
  },
  "smtp_username": {
    "value": "apikey",
    "type": "string",
    "description": "SMTP authentication username"
  },
  "smtp_password": {
    "value": "***encrypted***",
    "type": "string",
    "encrypted": true,
    "description": "SMTP authentication password"
  },
  "from_email": {
    "value": "noreply@volumeviz.com",
    "type": "email",
    "required": true,
    "description": "From email address"
  },
  "from_name": {
    "value": "VolumeViz",
    "type": "string",
    "description": "From name"
  }
}
```

### Retention Settings

```json
{
  "category": "retention",
  "scan_jobs_ttl_days": {
    "value": 90,
    "type": "number",
    "min": 1,
    "max": 3650,
    "description": "Keep scan job records for X days"
  },
  "volume_metrics_ttl_days": {
    "value": 365,
    "type": "number",
    "description": "Keep volume metrics for X days"
  },
  "audit_logs_ttl_days": {
    "value": 730,
    "type": "number",
    "description": "Keep audit logs for X days (2 years for compliance)"
  },
  "auto_cleanup_enabled": {
    "value": true,
    "type": "boolean",
    "description": "Automatically clean up old data"
  }
}
```

---

## ✅ Acceptance Criteria

### System Admin Can:
- [ ] View and edit all system settings via UI
- [ ] Create/edit/delete organizations
- [ ] Create/edit/delete users across all orgs
- [ ] View audit logs with advanced filtering
- [ ] Monitor system health and performance
- [ ] Test email/webhook/SSO integration
- [ ] Export system diagnostics
- [ ] Manage API keys globally

### Organization Admin Can:
- [ ] View and edit org-specific settings
- [ ] Invite/remove members
- [ ] Assign roles to members
- [ ] View org usage and quotas
- [ ] Configure org-level retention
- [ ] Create custom alert templates

### System:
- [ ] Hot reloads config changes (no restart)
- [ ] Validates all settings before saving
- [ ] Encrypts sensitive values in database
- [ ] Logs all admin actions to audit trail
- [ ] Enforces quotas and rate limits from config
- [ ] Supports config import/export for backup

---

## 📝 Nice-to-Have Features (Future)

1. **Configuration Versioning**
   - Track config history
   - Rollback to previous config
   - Diff between versions

2. **Multi-Environment Config**
   - Dev/Staging/Production configs
   - Environment-specific overrides
   - Deployment automation

3. **Configuration Templates**
   - Pre-built configs for common scenarios
   - "Development", "Production", "High Security" templates
   - One-click apply

4. **Advanced Monitoring**
   - Config drift detection
   - Compliance scanning
   - Security recommendations

5. **GraphQL Admin API**
   - More flexible queries
   - Subscriptions for real-time updates
   - Better batching

---

## 🎯 Priority Ranking

**MUST HAVE (Phase 1-2):**
1. System settings management (Email, Auth, Security)
2. Organization management (CRUD, members, quotas)
3. User management (CRUD, roles, password reset)
4. Audit log viewer
5. Basic monitoring dashboard

**SHOULD HAVE (Phase 3):**
1. Feature flags system
2. API key management
3. Webhook testing
4. Settings import/export
5. Integration testing tools

**NICE TO HAVE (Future):**
1. License management
2. Config versioning
3. Email template editor
3. Advanced compliance reports
4. Multi-environment configs

---

**Summary:** The current system has **zero admin/config management**. This plan adds a complete 3-tier config system (client/org/system) with a full admin panel. **Estimated: 8-10 weeks** for complete implementation.
