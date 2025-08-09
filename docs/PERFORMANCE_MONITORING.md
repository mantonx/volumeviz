# VolumeViz Performance Monitoring

This document describes the comprehensive performance monitoring and testing infrastructure for VolumeViz.

## Overview

VolumeViz includes a complete performance monitoring stack with:
- **Metrics Collection**: Prometheus metrics with custom API instrumentation
- **Visualization**: Grafana dashboards for real-time performance monitoring
- **Automated Testing**: k6-based performance tests integrated with CI/CD
- **Alerting**: Performance threshold monitoring and reporting

## Architecture

### Metrics Collection Stack
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  VolumeViz API  │───→│   Prometheus    │───→│     Grafana     │
│   (Port 8080)   │    │   (Port 9090)   │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Performance     │
│ Test Reports    │
│ (k6 + GitHub)   │
└─────────────────┘
```

### Key Components

1. **API Metrics Middleware** (`internal/api/middleware/metrics.go`)
   - HTTP request duration, size, and error tracking
   - WebSocket connection monitoring
   - Volume scan operation metrics
   - Database query performance

2. **Monitoring Stack** (`docker-compose.monitoring.yml`)
   - Prometheus for metrics collection
   - Grafana for visualization with pre-configured dashboards
   - Node Exporter for system metrics
   - cAdvisor for container metrics
   - pgAdmin for database monitoring

3. **Performance Testing** (`scripts/performance-test.sh`)
   - k6-based load testing
   - Automated CI/CD integration
   - HTML and JSON reporting
   - Threshold validation

## Quick Start

### 1. Start Monitoring Stack
```bash
# Start the complete monitoring infrastructure
docker-compose -f docker-compose.monitoring.yml up -d

# Access monitoring interfaces
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3001 (admin/admin)"
echo "pgAdmin: http://localhost:5050"
```

### 2. Run Performance Tests
```bash
# Run performance tests against local API
./scripts/performance-test.sh

# Customize test parameters
API_URL=http://localhost:8080/api/v1 \
CONCURRENT_USERS=20 \
DURATION=120s \
./scripts/performance-test.sh
```

### 3. View Results
- **Grafana Dashboard**: http://localhost:3001/d/volumeviz-performance
- **Performance Reports**: `./performance-reports/`
- **Prometheus Metrics**: http://localhost:9090/metrics

## Metrics Reference

### HTTP Metrics
| Metric | Description | Type | Labels |
|--------|-------------|------|--------|
| `http_request_duration_seconds` | HTTP request duration | Histogram | method, path, status |
| `http_requests_total` | Total HTTP requests | Counter | method, path, status |
| `http_request_size_bytes` | HTTP request size | Histogram | method, path |
| `http_response_size_bytes` | HTTP response size | Histogram | method, path, status |
| `http_requests_in_flight` | Active HTTP requests | Gauge | method, path |

### Application Metrics
| Metric | Description | Type | Labels |
|--------|-------------|------|--------|
| `volume_scan_duration_seconds` | Volume scan duration | Histogram | volume_id, scan_type |
| `volume_scan_errors_total` | Volume scan errors | Counter | volume_id, error_type |
| `websocket_connections_active` | Active WebSocket connections | Gauge | - |
| `websocket_messages_received_total` | WebSocket messages received | Counter | message_type |
| `websocket_messages_sent_total` | WebSocket messages sent | Counter | message_type |
| `database_query_duration_seconds` | Database query duration | Histogram | query_type, table |

## Performance Testing

### Test Configuration
The performance tests are configured with the following thresholds:
- **P95 Response Time**: < 500ms
- **P99 Response Time**: < 1000ms
- **Error Rate**: < 10%
- **Request Rate**: Configurable (default: 10 concurrent users)

### Test Scenarios
1. **Health Check**: Basic API health verification
2. **Volume List**: Paginated volume listing performance
3. **Volume Details**: Individual volume retrieval
4. **WebSocket**: Real-time connection testing (optional)

### CI/CD Integration
Performance tests run automatically on:
- Pull requests affecting API code
- Manual workflow dispatch
- Can be scheduled for regular monitoring

Results are posted as PR comments and stored as artifacts.

## Grafana Dashboards

### VolumeViz Performance Dashboard
The main dashboard includes:
- **Request Rate**: Real-time request throughput
- **Response Times**: P95/P99 latency monitoring  
- **Error Rate**: HTTP error percentage with thresholds
- **In-Flight Requests**: Current active requests
- **WebSocket Connections**: Real-time connection count
- **Volume Scan Performance**: Scan operation metrics

### Custom Dashboards
Create additional dashboards for:
- Database performance monitoring
- System resource utilization
- Business metrics and KPIs

## Alerting Setup

### Recommended Alerts
1. **High Response Time**: P95 > 500ms for 5+ minutes
2. **High Error Rate**: Error rate > 5% for 2+ minutes
3. **Service Unavailable**: Health check failures
4. **High Memory Usage**: Container memory > 80%
5. **Database Connection Issues**: Connection pool exhaustion

### Alert Configuration
Alerts can be configured in:
- Grafana (built-in alerting)
- Prometheus Alertmanager
- External monitoring services (PagerDuty, OpsGenie)

## Troubleshooting

### Common Issues

**Q: No metrics showing in Grafana**
- Verify Prometheus is scraping the API: Check http://localhost:9090/targets
- Ensure API is exposing metrics: Check http://localhost:8080/metrics
- Verify network connectivity between containers

**Q: Performance tests failing**
- Check API health: `curl http://localhost:8080/api/v1/health`
- Verify k6 installation: `k6 version`
- Review test logs in `performance-reports/`

**Q: High resource usage during monitoring**
- Adjust Prometheus retention: `--storage.tsdb.retention.time=7d`
- Reduce scrape intervals for non-critical metrics
- Use recording rules for expensive queries

### Performance Optimization

1. **API Performance**
   - Enable database connection pooling
   - Add response caching for static data
   - Optimize database queries with indexes
   - Implement request rate limiting

2. **Monitoring Overhead**
   - Use sampling for high-volume metrics
   - Aggregate metrics with recording rules
   - Configure metric retention policies
   - Monitor monitoring stack resource usage

## Development

### Adding New Metrics
1. Define metrics in `internal/api/middleware/metrics.go`
2. Instrument code with metric recording
3. Update Grafana dashboards
4. Add to this documentation

### Custom Performance Tests
1. Extend `scripts/performance-test.sh`
2. Add new k6 test scenarios
3. Update CI workflow as needed
4. Create custom reporting

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [k6 Performance Testing](https://k6.io/docs/)
- [VolumeViz API Documentation](/docs/openapi.yaml)
