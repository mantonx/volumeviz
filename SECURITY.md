# Security Policy

## 🔒 Security Overview

VolumeViz takes security seriously and implements multiple layers of protection to ensure the safety and integrity of your data. This document outlines our security practices, how to report vulnerabilities, and guidelines for secure deployment.

## 🛡️ Security Features

### Authentication & Authorization

#### JWT-Based Authentication
- Secure JSON Web Token implementation with configurable expiration
- RSA/ECDSA signing algorithms for token integrity
- Refresh token mechanism for extended sessions
- Automatic token rotation and revocation support

#### Role-Based Access Control (RBAC)
- **Admin Role**: Full system access including user management
- **User Role**: Standard volume viewing and analysis permissions  
- **Viewer Role**: Read-only access to dashboards and reports
- **API Role**: Programmatic access with limited scope

#### Session Management
- Secure session handling with configurable timeouts
- Session invalidation on security events
- Concurrent session limiting per user
- Secure logout with token blacklisting

### Data Protection

#### Encryption
- **In Transit**: TLS 1.3 for all API communications
- **At Rest**: Database encryption support (PostgreSQL TDE, SQLite encryption)
- **JWT Tokens**: Encrypted payload with secure signing keys
- **Sensitive Data**: Hashed passwords with bcrypt (cost factor 12+)

#### Data Validation & Sanitization
- Comprehensive input validation on all API endpoints
- SQL injection prevention through parameterized queries (SQLC)
- XSS protection with Content Security Policy (CSP)
- File upload restrictions and content validation

#### Privacy & Compliance
- No collection of personally identifiable information (PII)
- Volume metadata stored securely with access controls
- Audit logging for compliance requirements
- Data retention policies configurable by deployment

### Infrastructure Security

#### Database Security
- Connection pooling with secure connection strings
- Database user permissions following principle of least privilege  
- Prepared statements preventing SQL injection
- Regular security updates for database engines

#### Container Security
- Non-root user execution in containers
- Minimal base images with security updates
- Secret management through environment variables or mounted volumes
- Network segmentation with container isolation

#### API Security
- Rate limiting to prevent abuse and DDoS attacks
- Request size limits to prevent resource exhaustion
- CORS configuration for web browser security
- Security headers (HSTS, X-Frame-Options, etc.)

## 🚨 Vulnerability Reporting

### Reporting Process

We appreciate responsible disclosure of security vulnerabilities. Please follow these steps:

#### 1. **Do Not** Create Public Issues
- Do not report security vulnerabilities through public GitHub issues
- Do not discuss vulnerabilities in public forums or social media

#### 2. **Report Privately**
Send detailed vulnerability reports to: **security@volumeviz.dev**

Include in your report:
- Description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected versions or components
- Any proof-of-concept code or screenshots
- Suggested mitigation strategies (if any)

#### 3. **Response Timeline**
- **Initial Response**: Within 24 hours of report receipt
- **Assessment**: Vulnerability triage within 72 hours
- **Resolution**: Critical issues addressed within 7 days
- **Disclosure**: Coordinated disclosure after fix deployment

### Vulnerability Classification

#### Critical (CVSS 9.0-10.0)
- Remote code execution vulnerabilities
- Authentication bypass leading to admin access
- Complete system compromise

#### High (CVSS 7.0-8.9)  
- Privilege escalation vulnerabilities
- Data exposure affecting multiple users
- Significant security control bypasses

#### Medium (CVSS 4.0-6.9)
- Limited data exposure
- Cross-site scripting (XSS) vulnerabilities
- Information disclosure with limited impact

#### Low (CVSS 0.1-3.9)
- Minor information leaks
- Low-impact denial of service
- Configuration weaknesses

### Bounty Program

While we don't currently offer monetary rewards, we recognize security researchers by:
- Public acknowledgment (with permission) in release notes
- Priority support for future security questions
- Consideration for beta testing new security features

## 🔧 Secure Deployment Guidelines

### Environment Configuration

#### Production Settings
```bash
# Use strong, unique passwords
DB_PASSWORD=$(openssl rand -base64 32)

# Enable secure connections
DB_SSLMODE=require
API_TLS_ENABLED=true

# Set secure session configuration
JWT_SIGNING_KEY=$(openssl rand -base64 64)
JWT_EXPIRATION=1h
SESSION_TIMEOUT=30m

# Enable security headers
SECURITY_HEADERS_ENABLED=true
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

#### Network Security
- Deploy behind a reverse proxy (nginx, Apache, Cloudflare)
- Use HTTPS/TLS for all communications
- Implement network segmentation and firewall rules
- Restrict database access to application servers only

#### Container Security
```bash
# Run with non-root user
docker run --user 1000:1000 volumeviz

# Limit resources and capabilities
docker run --memory=512m --cpus=1 --cap-drop=ALL volumeviz

# Use read-only filesystem where possible
docker run --read-only --tmpfs /tmp volumeviz
```

### Database Security

#### PostgreSQL Configuration
```sql
-- Create dedicated database user
CREATE USER volumeviz WITH PASSWORD 'strong_random_password';
GRANT CONNECT ON DATABASE volumeviz TO volumeviz;
GRANT USAGE ON SCHEMA public TO volumeviz;

-- Grant minimal required permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO volumeviz;
```

#### Connection Security
- Always use encrypted connections (`sslmode=require`)
- Use certificate-based authentication when possible
- Rotate database passwords regularly
- Monitor for unusual database activity

### Monitoring & Alerting

#### Security Monitoring
- Failed authentication attempts
- Unusual API access patterns
- Database connection anomalies
- Resource usage spikes

#### Audit Logging
```json
{
  "timestamp": "2025-08-14T20:00:00Z",
  "user_id": "admin@example.com",
  "action": "volume_scan_initiated", 
  "resource": "volume_id:vol-123",
  "ip_address": "192.168.1.100",
  "user_agent": "VolumeViz-CLI/1.0.0",
  "result": "success"
}
```

## 📋 Security Checklist

### Pre-Deployment
- [ ] Change all default passwords and secrets
- [ ] Configure TLS/SSL certificates
- [ ] Set up proper firewall rules
- [ ] Enable audit logging
- [ ] Configure backup encryption
- [ ] Test disaster recovery procedures

### Regular Maintenance  
- [ ] Apply security updates monthly
- [ ] Rotate JWT signing keys quarterly
- [ ] Review user access permissions
- [ ] Monitor security audit logs
- [ ] Perform vulnerability scans
- [ ] Update dependency libraries

### Incident Response
- [ ] Document security incident procedures
- [ ] Establish communication channels
- [ ] Prepare system isolation procedures
- [ ] Configure automated alerting
- [ ] Test incident response plan annually

## 🆕 Security Updates

### Notification Methods
- **Critical Security Alerts**: Direct email to registered administrators
- **Security Advisories**: GitHub Security Advisories
- **Release Notes**: Security fixes highlighted in CHANGELOG.md
- **RSS Feed**: Subscribe to security-only updates

### Update Procedures
1. **Emergency Patches**: Applied immediately for critical vulnerabilities
2. **Regular Updates**: Monthly security update cycle
3. **Major Updates**: Quarterly comprehensive security reviews

## 📞 Contact Information

### Security Team
- **Primary Contact**: security@volumeviz.dev
- **PGP Key**: [Link to public key for encrypted communications]
- **Response Hours**: 24/7 for critical issues, business hours for others

### Additional Resources
- **Security Documentation**: `/docs/security/`
- **Compliance Information**: `/docs/compliance/`
- **Security Architecture**: `/docs/adr/` (Architecture Decision Records)

---

**Last Updated**: August 14, 2025  
**Next Review**: November 14, 2025

*This security policy is reviewed quarterly and updated as needed to reflect current security practices and threat landscape.*
