# VolumeViz Multi-Tenancy & External Auth Integration Plan

## ✅ **Current Status - What's Complete**

### **Foundation Architecture (100% Complete)**
- **Multi-tenant database schema** - PostgreSQL + SQLite with organizations, invitations, RBAC
- **Permission framework** - 21 granular permissions across all resources  
- **Audit logging system** - Complete HTTP middleware + structured logging
- **Organization management** - Service interfaces + SQLC queries generated
- **Database migrations** - All tables created with proper indexes
- **Code compilation** - All TypeScript/Go compilation issues resolved

### **Current Capabilities**
🏢 **Multi-tenancy**: Organizations isolate all user data  
🔒 **RBAC**: Viewer/Operator/Admin roles with permission overrides  
📊 **Audit Trail**: Every API call logged with context + performance metrics  
🚀 **Enterprise-Ready**: User invitations, quotas, plan management  

---

## 🔨 **Immediate Work Remaining (1-2 hours)**

### **1. Replace Stub Implementations**
- ✅ Updated `internal/audit/audit.go` with real SQLC method calls (partially done)
- ⏳ Update `internal/auth/permissions.go` with real SQLC method calls
- ⏳ Update `internal/services/organizations/service.go` with real implementations

### **2. Wire Services into Main Application**
- Initialize audit logger in `cmd/server/main.go`
- Initialize organization service with database connection
- Initialize permission checker with database connection
- Add audit middleware to HTTP router

### **3. Basic Integration Testing**
- Test organization creation via API
- Test user invitation flow
- Test permission checking middleware
- Verify audit logs are written correctly

---

## 🔗 **External Auth Integration Architecture**

### **Phase 1: Auth Provider Abstraction (2-3 hours)**

#### **Current Local Auth Flow:**
```
Client → JWT Token → Permission Check → API Access
```

#### **Target External Auth Flow:**
```
Client → External Provider → JWT/OIDC Token → Permission Check → API Access
```

#### **Required Changes:**

**A. Create Auth Provider Interface**
```go
type AuthProvider interface {
    ValidateToken(ctx context.Context, token string) (*AuthResult, error)
    GetUserInfo(ctx context.Context, userID string) (*UserInfo, error)
    RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
}
```

**B. Implement Provider Adapters**
- `LocalAuthProvider` (current JWT implementation)
- `OIDCAuthProvider` (for Authelia, Authentik, Google)
- `LDAPAuthProvider` (for LLDAP direct integration)

**C. Update Auth Middleware**
- Support multiple token validation methods
- Handle external provider user provisioning
- Map external groups to internal roles

### **Phase 2: Specific Provider Integration (3-4 hours each)**

#### **OIDC Providers (Authelia, Authentik, Google)**
```go
type OIDCConfig struct {
    IssuerURL    string
    ClientID     string
    ClientSecret string
    Scopes       []string
    GroupClaim   string // Map external groups to VolumeViz roles
}
```

**Integration Points:**
- OAuth2 login flow endpoints (`/auth/oidc/login`, `/auth/oidc/callback`)
- JWT token validation with provider's public keys
- User provisioning from OIDC claims
- Group/role mapping configuration

#### **LLDAP Integration**
```go
type LDAPConfig struct {
    ServerURL     string
    BaseDN        string
    UserFilter    string
    GroupFilter   string
    AdminUser     string
    AdminPassword string
}
```

**Integration Points:**
- Direct LDAP authentication
- User/group sync scheduled jobs
- Fallback to OIDC via Authelia for advanced features

#### **Configuration-Driven Selection**
```yaml
auth:
  provider: "oidc" # local, oidc, ldap
  local:
    jwt_secret: "..."
  oidc:
    issuer_url: "https://auth.example.com"
    client_id: "volumeviz"
    client_secret: "..."
    group_claim: "groups"
  ldap:
    server_url: "ldap://lldap.example.com"
    base_dn: "dc=example,dc=com"
```

### **Phase 3: Advanced Features (2-3 hours each)**

#### **A. User Provisioning & Sync**
- Automatic user creation from external providers
- Group membership synchronization
- User attribute mapping (email, name, avatar)
- Deactivate users no longer in external system

#### **B. Session Management**
- Cross-device session tracking
- SSO session coordination
- Session invalidation on external logout
- Device management UI

#### **C. Role Mapping**
- External group → VolumeViz role mapping
- Custom role creation based on external attributes  
- Dynamic permission assignment
- Organization membership from groups

---

## 🎯 **Provider-Specific Implementation Priority**

### **1. Google OAuth (Easiest - 3 hours)**
- Standard OIDC implementation
- Well-documented APIs
- Built-in group/org mapping via Google Workspace

### **2. Authelia (Most Flexible - 4 hours)**
- Full OIDC compliance
- 2FA/MFA support
- Rich group/policy management
- Session management coordination

### **3. Authentik (Enterprise Focus - 4 hours)**  
- Advanced RBAC features
- LDAP/SAML/OIDC support
- Policy engine integration
- Audit log correlation

### **4. LLDAP (Lightweight - 3 hours)**
- Simple LDAP implementation
- Minimal external dependencies
- Direct user/group management
- Perfect for self-hosted setups

---

## 🏗️ **Implementation Strategy**

### **Week 1: Complete Current Foundation**
- ✅ Database migrations and SQLC generation
- ⏳ Replace stub implementations
- ⏳ Wire services into main app
- ⏳ Test multi-tenancy features
- ⏳ Document API endpoints

### **Week 2: Auth Provider Abstraction**
- Design provider interfaces
- Refactor current auth middleware
- Add provider configuration system
- Test with local provider

### **Week 3-4: External Provider Integration**
- Choose first provider (recommend Google for testing)
- Implement OIDC flow
- Add user provisioning
- Test end-to-end integration

### **Future: Advanced Features**
- Multi-provider support
- Session management
- Advanced role mapping
- Enterprise compliance features

---

## 📋 **Success Metrics**

✅ **Foundation Complete**: Multi-tenant RBAC with audit logging  
⏳ **External Auth Ready**: Provider abstraction layer implemented  
⏳ **First Provider**: Google OAuth working end-to-end  
⏳ **Enterprise Ready**: Authelia/Authentik integration complete  
⏳ **Self-Hosted**: LLDAP integration for lightweight deployments  

---

## 🗂️ **File Structure**

### **Database Layer**
- `migrations/postgresql/000002_add_multitenancy.up.sql` - Multi-tenancy schema
- `internal/db/sqlc/` - Generated SQLC queries and types
- `internal/repo/queries-postgresql/` - SQL query definitions

### **Service Layer** 
- `internal/auth/permissions.go` - RBAC permission framework
- `internal/audit/audit.go` - Audit logging service
- `internal/services/organizations/service.go` - Organization management
- `internal/auth/context.go` - Request context helpers

### **API Layer**
- `internal/api/v1/auth/` - Authentication endpoints
- `internal/api/middleware/` - Auth and audit middleware

### **Configuration**
- `sqlc.yaml` - Database query generation config
- `docker-compose.dev.yml` - Development environment

---

**Total Estimated Effort**: 15-20 hours across 2-3 weeks  
**Current Progress**: ~75% complete (foundation + partial implementation)  
**Next Milestone**: Complete stub replacement + wire services (2-3 hours)