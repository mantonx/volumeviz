# Docker API Integration Setup Guide

## Overview

VolumeViz integrates with Docker through the official Docker API client to provide real-time volume discovery, metadata extraction, and container correlation. This guide covers setup, configuration, troubleshooting, and performance optimization.

## Prerequisites

### Docker Requirements
- Docker Engine 20.10+ (API version 1.41+)
- Docker Socket accessible (`/var/run/docker.sock`)
- Appropriate permissions for Docker API access

### Network Requirements
- Local Docker socket: Unix socket access
- Remote Docker: TCP port 2376 (TLS) or 2375 (non-TLS)
- Firewall rules configured for remote access

## Configuration

### Local Docker Socket (Recommended)

```yaml
# docker compose.yml
version: '3.8'
services:
  volumeviz:
    image: volumeviz:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock
      - DOCKER_API_TIMEOUT=30s
```

### Remote Docker Host

```yaml
version: '3.8'
services:
  volumeviz:
    image: volumeviz:latest
    environment:
      - DOCKER_HOST=tcp://remote-docker:2376
      - DOCKER_TLS_VERIFY=1
      - DOCKER_CERT_PATH=/certs
      - DOCKER_API_TIMEOUT=30s
    volumes:
      - ./docker-certs:/certs:ro
```

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DOCKER_HOST` | Docker endpoint | `unix:///var/run/docker.sock` | `tcp://localhost:2376` |
| `DOCKER_API_TIMEOUT` | API timeout | `30s` | `60s` |
| `DOCKER_TLS_VERIFY` | Enable TLS verification | `0` | `1` |
| `DOCKER_CERT_PATH` | TLS certificate path | - | `/certs` |
| `DOCKER_TLS_CA_CERT` | CA certificate file | `ca.pem` | `custom-ca.pem` |
| `DOCKER_TLS_CERT` | Client certificate | `cert.pem` | `client-cert.pem` |
| `DOCKER_TLS_KEY` | Client private key | `key.pem` | `client-key.pem` |

## Security Configuration

### TLS Setup (Recommended for Remote)

1. **Generate TLS Certificates**
```bash
# Create CA
openssl genrsa -out ca-key.pem 4096
openssl req -new -x509 -days 365 -key ca-key.pem -sha256 -out ca.pem

# Create server certificate
openssl genrsa -out server-key.pem 4096
openssl req -subj "/CN=docker-host" -sha256 -new -key server-key.pem -out server.csr
openssl x509 -req -days 365 -sha256 -in server.csr -CA ca.pem -CAkey ca-key.pem -out server-cert.pem

# Create client certificate  
openssl genrsa -out key.pem 4096
openssl req -subj "/CN=volumeviz-client" -new -key key.pem -out client.csr
openssl x509 -req -days 365 -sha256 -in client.csr -CA ca.pem -CAkey ca-key.pem -out cert.pem
```

2. **Configure Docker Daemon**
```bash
# /etc/docker/daemon.json
{
  "hosts": ["tcp://0.0.0.0:2376", "unix:///var/run/docker.sock"],
  "tls": true,
  "tlscert": "/etc/docker/certs/server-cert.pem",
  "tlskey": "/etc/docker/certs/server-key.pem",
  "tlsverify": true,
  "tlscacert": "/etc/docker/certs/ca.pem"
}
```

### Permission Management

#### Docker Socket Permissions
```bash
# Add user to docker group (local development)
sudo usermod -aG docker $USER

# Set specific socket permissions
sudo chmod 660 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock
```

#### Container Security
```yaml
# Rootless container (recommended)
version: '3.8'
services:
  volumeviz:
    image: volumeviz:latest
    user: "1000:1000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
```

## Performance Optimization

### Connection Pooling
```go
// Example configuration in Go
client, err := docker.NewClientWithOpts(
    docker.WithHost("unix:///var/run/docker.sock"),
    docker.WithTimeout(30*time.Second),
    docker.WithHTTPClient(&http.Client{
        Transport: &http.Transport{
            MaxIdleConns:        100,
            MaxIdleConnsPerHost: 10,
            IdleConnTimeout:     90 * time.Second,
        },
    }),
)
```

### Caching Strategy
- **Volume List Caching**: Cache volume lists for 30 seconds
- **Volume Details**: Cache individual volume details for 5 minutes
- **Container Relations**: Cache container mappings for 1 minute

### Rate Limiting
```yaml
# Nginx rate limiting (if using proxy)
upstream volumeviz {
  server volumeviz:8080;
}

server {
  location /api/v1/volumes {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://volumeviz;
  }
}
```

## Monitoring & Observability

### Health Checks
```yaml
version: '3.8'
services:
  volumeviz:
    image: volumeviz:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Prometheus Metrics
Key metrics exposed at `/metrics`:
- `docker_api_requests_total` - Total API requests by endpoint
- `docker_api_request_duration_seconds` - Request duration histogram
- `docker_api_errors_total` - API errors by type
- `docker_connection_status` - Connection health (0/1)
- `docker_volumes_total` - Total volumes discovered

### Structured Logging
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "component": "docker-client",
  "operation": "list_volumes",
  "duration_ms": 245,
  "volume_count": 127,
  "correlation_id": "req-123456"
}
```

## Troubleshooting

### Common Issues

#### Connection Refused
**Symptom**: `Cannot connect to the Docker daemon`
**Solutions**:
1. Verify Docker daemon is running: `docker ps`
2. Check socket permissions: `ls -la /var/run/docker.sock`
3. Verify DOCKER_HOST environment variable
4. Test connection: `curl --unix-socket /var/run/docker.sock http://localhost/info`

#### Permission Denied
**Symptom**: `Permission denied while trying to connect`
**Solutions**:
1. Add user to docker group: `sudo usermod -aG docker $USER`
2. Check socket ownership: `sudo chown root:docker /var/run/docker.sock`
3. Restart Docker service: `sudo systemctl restart docker`
4. Verify container user ID matches socket group

#### TLS Verification Failed
**Symptom**: `x509: certificate signed by unknown authority`
**Solutions**:
1. Verify certificate paths are correct
2. Check certificate validity: `openssl x509 -in cert.pem -text -noout`
3. Ensure CA certificate is properly configured
4. Validate certificate chain: `openssl verify -CAfile ca.pem cert.pem`

#### Timeout Errors
**Symptom**: `context deadline exceeded`
**Solutions**:
1. Increase `DOCKER_API_TIMEOUT` value
2. Check network latency to Docker host
3. Optimize Docker daemon performance
4. Review container resource limits

#### High Memory Usage
**Symptom**: Container consuming excessive memory
**Solutions**:
1. Implement response pagination for large volume lists
2. Adjust caching TTL values
3. Monitor garbage collection frequency
4. Set container memory limits

### Performance Troubleshooting

#### Slow Volume Listing
```bash
# Measure Docker API performance directly
time docker volume ls --format "table {{.Name}}\t{{.Driver}}\t{{.CreatedAt}}"

# Check VolumeViz API performance
time curl -s http://localhost:8080/api/v1/volumes | jq length
```

#### Memory Profiling
```bash
# Enable Go profiling
curl http://localhost:8080/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# Analyze memory usage
(pprof) top 10
(pprof) list main.handleListVolumes
```

#### Connection Pool Analysis
```bash
# Monitor connection statistics
netstat -an | grep :2376
ss -tuln | grep :2376

# Check connection pool metrics
curl -s http://localhost:8080/metrics | grep docker_connection
```

## Best Practices

### Development
1. **Use Local Socket**: Faster and more secure for development
2. **Mock for Testing**: Use testcontainers for integration tests
3. **Handle Errors Gracefully**: Implement circuit breaker patterns
4. **Log Comprehensively**: Include correlation IDs and timing

### Production
1. **Enable TLS**: Always use TLS for remote Docker connections
2. **Monitor Connections**: Track connection health and performance
3. **Implement Rate Limiting**: Protect against API abuse
4. **Use Least Privilege**: Run containers with minimal permissions
5. **Regular Health Checks**: Monitor Docker daemon connectivity

### Scaling
1. **Connection Pooling**: Reuse connections efficiently
2. **Caching Strategy**: Cache frequently accessed data
3. **Horizontal Scaling**: Multiple VolumeViz instances with load balancing
4. **Circuit Breakers**: Prevent cascade failures

## API Reference

### Docker Client Configuration
```go
type DockerConfig struct {
    Host           string        `yaml:"host"`
    Timeout        time.Duration `yaml:"timeout"`
    TLSVerify      bool          `yaml:"tls_verify"`
    CertPath       string        `yaml:"cert_path"`
    MaxRetries     int           `yaml:"max_retries"`
    RetryDelay     time.Duration `yaml:"retry_delay"`
}
```

### Error Handling
```go
// Standard error types
type DockerError struct {
    Operation string
    Endpoint  string
    Code      string
    Message   string
    Retry     bool
}
```

## Migration Guide

### From Docker API v1.40 to v1.41+
- Update volume filtering syntax
- Handle new volume metadata fields
- Adjust timeout configurations

### Legacy Socket Configurations
```bash
# Old: Direct socket mount
-v /var/run/docker.sock:/var/run/docker.sock

# New: Read-only with specific permissions
-v /var/run/docker.sock:/var/run/docker.sock:ro
--user $(id -u):$(getent group docker | cut -d: -f3)
```

## Support

### Debugging Commands
```bash
# Test Docker connectivity
docker version
docker info

# Check VolumeViz health
curl http://localhost:8080/health/docker

# View detailed logs
docker logs volumeviz --tail 100 -f

# Monitor API performance
curl -s http://localhost:8080/metrics | grep docker_api
```

### Log Analysis
```bash
# Extract Docker API errors
journalctl -u docker --since "1 hour ago" | grep ERROR

# Monitor VolumeViz performance
docker logs volumeviz 2>&1 | grep "duration_ms" | tail -20
```