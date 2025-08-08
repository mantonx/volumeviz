# Security Policy

## Reporting Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

### Preferred Method: GitHub Private Vulnerability Reporting

We use GitHub's Private Vulnerability Reporting feature for secure disclosure:

1. Go to the [Security tab](https://github.com/mantonx/volumeviz/security) of this repository
2. Click "Report a vulnerability" 
3. Fill out the vulnerability report form with details
4. Submit the report

### Alternative: Email

If GitHub Private Vulnerability Reporting is not available:

**Email**: security@volumeviz.io  
**GPG Key**: Available on request

### What to Include

Please include as much information as possible:

- **Vulnerability Type**: What type of vulnerability (authentication bypass, injection, etc.)
- **Impact**: What can be achieved by exploiting this vulnerability
- **Steps to Reproduce**: Clear steps to reproduce the issue
- **Affected Versions**: Which versions of VolumeViz are affected
- **Environment**: OS, Docker version, configuration details
- **Proof of Concept**: Code, screenshots, or examples (if available)

### Response Timeline

We are committed to responding to security reports promptly:

- **Initial Response**: Within 48 hours of receipt
- **Triage & Assessment**: Within 1 week
- **Progress Updates**: Weekly updates on complex issues
- **Resolution Target**: 
  - Critical vulnerabilities: 72 hours
  - High severity: 1 week
  - Medium severity: 2 weeks
  - Low severity: 4 weeks

### Disclosure Process

1. **Receipt**: We acknowledge receipt of your vulnerability report
2. **Assessment**: We assess the vulnerability and assign a severity level
3. **Development**: We develop and test a fix
4. **Release**: We release a security update
5. **Disclosure**: We coordinate public disclosure 

### Security Update Process

- Security fixes are released as patch versions
- Users are notified through GitHub Security Advisories
- Release notes clearly mark security fixes
- Critical vulnerabilities may trigger immediate notifications

## Overview

VolumeViz requires privileged access to Docker and filesystem resources to monitor volumes effectively. This document outlines important security considerations and best practices for deploying VolumeViz safely.

## Security Requirements

### Docker Socket Access

⚠️ **CRITICAL**: VolumeViz requires access to the Docker daemon socket (`/var/run/docker.sock`) to:
- Discover Docker volumes
- Read volume metadata 
- Query container mount information

**Security Implications**:
- **Root-equivalent access**: Any process with Docker socket access has root privileges on the host
- **Container escape potential**: Compromised VolumeViz could create privileged containers
- **Full system access**: Can read/write any file on the host through volume mounts

### Filesystem Access

VolumeViz needs read access to volume data directories:
- `/var/lib/docker/volumes/` - Docker managed volumes
- Custom bind mount paths (e.g., `/cifs/`, `/mnt/`)
- User-specified volume device paths

**Security Implications**:
- **Data exposure**: Can read contents of all mounted volumes
- **Permission escalation**: Runs as root to access protected directories
- **Network shares**: May access remote filesystems (NFS, CIFS, etc.)

## Deployment Security

### Production Deployment

**DO NOT** deploy VolumeViz in production without these protections:

1. **Network Isolation**
   ```yaml
   # Use dedicated network
   networks:
     volumeviz-internal:
       driver: bridge
       internal: true  # No external access
   ```

2. **Docker Socket Proxy** (Recommended)
   ```yaml
   # Use tecnativa/docker-socket-proxy
   docker-socket-proxy:
     image: tecnativa/docker-socket-proxy
     environment:
       CONTAINERS: 1
       VOLUMES: 1
       NETWORKS: 0
       IMAGES: 0
       SERVICES: 0
       TASKS: 0
       SECRETS: 0
       POST: 0
       BUILD: 0
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock:ro
   ```

3. **Access Controls**
   - Deploy behind authentication proxy (OAuth, LDAP, etc.)
   - Use firewall rules to restrict network access
   - Consider VPN-only access for remote monitoring

4. **Resource Limits**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
         cpus: '0.5'
   ```

### Development vs Production

| Environment | Security Level | Considerations |
|-------------|----------------|----------------|
| **Development** | Lower | Local Docker socket access acceptable |
| **Staging** | Medium | Use socket proxy, restrict network access |
| **Production** | High | Full isolation, authentication, monitoring |

## Volume Data Security

### Read-Only Access

VolumeViz accesses volume data in **read-only mode** by default:
- Volume scanning uses read-only filesystem operations
- No modification of user data
- Size calculation only reads file metadata

### Sensitive Data Handling

**VolumeViz may encounter sensitive data** during volume scanning:
- Database files
- Application secrets
- User personal data
- Backup archives

**Mitigation**:
- Volume content is not stored or transmitted
- Only file sizes and metadata are collected
- Enable debug logging only in secure environments
- Use volume exclusion patterns for sensitive paths

## Authentication & Authorization

### No Built-in Authentication

⚠️ **VolumeViz does not include built-in authentication**

For production use, deploy behind:
- **Reverse proxy with authentication** (nginx + auth modules)
- **Authentication gateway** (OAuth2 Proxy, Authelia)
- **VPN or network-level restrictions**

### API Security

- **No API keys**: REST API is unauthenticated
- **No rate limiting**: Built-in rate limiting not implemented
- **CORS configuration**: Configure appropriately for your environment

## Network Security

### Port Exposure

Default ports exposed by VolumeViz:
- `3000`: Frontend web interface
- `8080`: Backend API
- `9090`: Prometheus metrics (if enabled)

**Production recommendations**:
- Bind to localhost only: `127.0.0.1:8080`
- Use reverse proxy for external access
- Disable metrics endpoint if not needed

### TLS/SSL

VolumeViz does not provide built-in TLS termination:
- Use reverse proxy for HTTPS (nginx, Traefik, etc.)
- Ensure all external communication is encrypted
- Use secure WebSocket (wss://) for real-time features

## Container Security

### Running as Root

VolumeViz backend container runs as **root** to access:
- Docker socket
- Volume directories in `/var/lib/docker/volumes/`
- Custom mount paths

**Mitigation strategies**:
- Use minimal container base images
- Apply security patches regularly
- Monitor container behavior
- Use security scanning tools (Trivy, Snyk, etc.)

### Container Isolation

```yaml
# Enhanced security configuration
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp:noexec,nosuid,size=100m
cap_drop:
  - ALL
cap_add:
  - DAC_OVERRIDE  # Required for volume access
  - DAC_READ_SEARCH
```

## Monitoring & Auditing

### Security Monitoring

Monitor these security-relevant events:
- Failed Docker API connections
- Volume scan failures (potential permission issues)
- Unusual volume access patterns
- High resource usage (potential abuse)

### Logging

Security-relevant log events:
```
level=warn msg="Failed to access volume" volume=/var/lib/docker/volumes/sensitive-data
level=error msg="Docker socket connection failed" 
level=info msg="Volume scan completed" volume=user-data size=1.2GB duration=45s
```

### Prometheus Metrics

Monitor security metrics:
- `volumeviz_docker_api_errors_total`
- `volumeviz_volume_scan_failures_total` 
- `volumeviz_unauthorized_access_attempts_total`

## Incident Response

### In Case of Security Incident

1. **Immediate Response**
   - Stop VolumeViz containers: `docker compose down`
   - Isolate affected systems from network
   - Preserve logs for analysis

2. **Assessment**
   - Check Docker audit logs
   - Review volume access patterns
   - Verify integrity of monitored data

3. **Recovery**
   - Update VolumeViz to latest version
   - Review and strengthen security configuration
   - Monitor for continued suspicious activity

## Reporting Security Issues

**Do not open public GitHub issues for security vulnerabilities.**

Report security issues privately:
- **Email**: security@volumeviz.example.com
- **GPG Key**: [Link to public key]
- **Response Time**: 48 hours for initial response

### Responsible Disclosure

We follow responsible disclosure practices:
1. Report received and acknowledged (48 hours)
2. Issue verified and assessed (1 week)
3. Fix developed and tested (2-4 weeks)
4. Coordinated public disclosure (after fix deployment)

## Security Updates

### Update Policy

- **Critical security updates**: Released immediately
- **High severity**: Released within 1 week  
- **Medium/Low severity**: Included in regular releases

### Notification

Security updates are announced via:
- GitHub Security Advisories
- Release notes with `[SECURITY]` tag
- Email notifications (if subscribed)

## Best Practices Checklist

- [ ] Deploy with Docker socket proxy in production
- [ ] Use authentication proxy for web interface
- [ ] Enable TLS/HTTPS for all external access
- [ ] Restrict network access with firewall rules
- [ ] Monitor security events and resource usage
- [ ] Keep VolumeViz updated to latest version
- [ ] Use read-only filesystem where possible
- [ ] Apply principle of least privilege
- [ ] Regular security audits and penetration testing
- [ ] Backup and disaster recovery procedures

## Compliance Considerations

### Data Privacy

- **Volume content access**: VolumeViz can read all volume data
- **Metadata collection**: Stores file paths, sizes, timestamps
- **GDPR/CCPA**: Consider data processing implications

### Industry Standards

VolumeViz security considerations for:
- **SOC 2**: Access controls, monitoring, incident response
- **ISO 27001**: Risk assessment, security policies
- **PCI DSS**: Network segmentation, access controls (if processing card data)
- **HIPAA**: Encryption, access controls (if processing health data)

---

**Remember**: VolumeViz is a powerful tool that requires careful security consideration. Always deploy with appropriate safeguards for your environment and risk tolerance.