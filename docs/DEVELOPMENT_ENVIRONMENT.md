# VolumeViz Development Environment

This document describes the comprehensive development environment for VolumeViz, including support for both PostgreSQL and SQLite databases with visualization and monitoring tools.

## Quick Start

### Start Development Environment

```bash
# Start both PostgreSQL and SQLite backends with full monitoring
./scripts/dev-start.sh

# Or start specific configurations
./scripts/dev-start.sh --profile postgres    # PostgreSQL only
./scripts/dev-start.sh --profile sqlite      # SQLite only
./scripts/dev-start.sh --profile minimal     # Fast startup (PostgreSQL only)
```

### Stop Development Environment

```bash
# Stop services (keep data)
./scripts/dev-stop.sh

# Stop and remove all data
./scripts/dev-stop.sh --clean
```

## Available Services

### 🐘 PostgreSQL Stack (Port 8080)

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **VolumeViz API** | http://localhost:8080 | - | Main application with PostgreSQL |
| **Frontend** | http://localhost:5173 | - | Web UI connected to PostgreSQL API |
| **pgAdmin** | http://localhost:5050 | dev@volumeviz.com / volumeviz | PostgreSQL database administration |
| **PostgreSQL** | localhost:5432 | volumeviz / volumeviz | Direct database access |

### 🗃️ SQLite Stack (Port 8081)

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **VolumeViz API** | http://localhost:8081 | - | Main application with SQLite |
| **Frontend** | http://localhost:5174 | - | Web UI connected to SQLite API |
| **SQLite Web** | http://localhost:8082 | - | SQLite database browser |

### 📊 Monitoring Stack

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **Grafana** | http://localhost:3000 | admin / volumeviz | Metrics visualization |
| **Prometheus** | http://localhost:9090 | - | Metrics collection |

## Database Performance Comparison

### Testing Both Databases

1. **Start both backends**:
   ```bash
   ./scripts/dev-start.sh --profile both
   ```

2. **Open both frontends** in different browser windows:
   - PostgreSQL: http://localhost:5173
   - SQLite: http://localhost:5174

3. **Run performance benchmark**:
   ```bash
   ./scripts/db-benchmark.sh
   ```

4. **View real-time metrics** in Grafana: http://localhost:3000

### Performance Characteristics

| Aspect | PostgreSQL (Port 8080) | SQLite (Port 8081) |
|--------|------------------------|-------------------|
| **Concurrent Users** | 100+ simultaneous | 1 writer + unlimited readers |
| **Write Performance** | 10K+ writes/sec (ACID) | 90K+ writes/sec (single-threaded) |
| **Query Performance** | Excellent for complex queries | Excellent for simple queries |
| **Memory Usage** | ~500MB+ (configurable) | ~320MB (64MB cache + 256MB mmap) |
| **Setup Time** | ~30 seconds | ~5 seconds |
| **Data Visualization** | pgAdmin (full SQL IDE) | SQLite Web (simple browser) |

## Development Workflows

### Database-Specific Development

#### PostgreSQL Development
```bash
# Start PostgreSQL stack only
./scripts/dev-start.sh --profile postgres

# Access database directly
psql -h localhost -U volumeviz -d volumeviz

# View performance in pgAdmin
open http://localhost:5050

# Monitor query performance
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

#### SQLite Development
```bash
# Start SQLite stack only
./scripts/dev-start.sh --profile sqlite

# Access database directly
sqlite3 /var/lib/docker/volumes/volumeviz_sqlite_data_dev/_data/volumeviz.db

# View database in browser
open http://localhost:8082

# Check SQLite optimizations
.databases
PRAGMA journal_mode;
PRAGMA cache_size;
```

### Performance Testing

#### Load Testing
```bash
# Generate test data
curl -X POST http://localhost:8080/api/v1/volumes/test-data \
  -H "Content-Type: application/json" \
  -d '{"count": 1000}'

# Compare the same operation on SQLite
curl -X POST http://localhost:8081/api/v1/volumes/test-data \
  -H "Content-Type: application/json" \
  -d '{"count": 1000}'
```

#### Benchmark Comparison
```bash
# Run Go benchmarks
go test -bench=BenchmarkSQLite ./internal/database/...
go test -bench=BenchmarkPostgreSQL ./internal/database/...

# View results in Grafana dashboard
open http://localhost:3000/d/volumeviz-performance
```

## Database Configurations Applied

### PostgreSQL Optimizations (Automatic)

**Connection-level**:
- 100 max connections, 50 idle connections
- 1-hour connection lifetime
- SSL preferred
- Performance parameters in connection string

**Session-level (30+ settings)**:
```sql
SET work_mem = '64MB';
SET effective_cache_size = '2GB';
SET random_page_cost = 1.1;
SET jit = on;
SET max_parallel_workers_per_gather = 4;
-- ... and 25+ more optimizations
```

### SQLite Optimizations (Automatic)

**Connection-level**:
- WAL mode for concurrency
- 64MB cache + 256MB memory-mapped I/O
- 4KB page size (SSD-optimized)
- Foreign key constraints enabled

**Runtime settings**:
```sql
PRAGMA journal_mode=WAL;
PRAGMA cache_size=-64000;  -- 64MB
PRAGMA mmap_size=268435456; -- 256MB
PRAGMA synchronous=NORMAL;
-- ... and 8+ more optimizations
```

## Monitoring and Observability

### Grafana Dashboards

Access Grafana at http://localhost:3000 (admin/volumeviz) to view:

- **Database Query Rate**: Operations per second by database type
- **Connection Pool Usage**: Active vs idle connections
- **Query Duration**: Response time percentiles
- **Table Sizes**: Storage utilization by table
- **Error Rates**: Failed operations by type

### Metrics Available

Both backends expose Prometheus metrics at `/metrics`:

- `volumeviz_db_queries_total` - Total database queries
- `volumeviz_db_query_duration_seconds` - Query execution time
- `volumeviz_db_connections_total` - Connection pool status  
- `volumeviz_db_table_size_bytes` - Table sizes
- `volumeviz_db_errors_total` - Database errors

### Log Analysis

```bash
# View backend logs
docker-compose -f docker-compose.dev.yml logs -f backend-postgres
docker-compose -f docker-compose.dev.yml logs -f backend-sqlite

# View database logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# View all logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker daemon
docker info

# Check port conflicts
netstat -tlnp | grep -E ':(5432|8080|8081|5173|5174)'

# Reset environment
./scripts/dev-stop.sh --clean
./scripts/dev-start.sh
```

#### Database Connection Issues
```bash
# Check PostgreSQL health
docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U volumeviz

# Check SQLite database file
docker-compose -f docker-compose.dev.yml exec backend-sqlite ls -la /data/

# Verify environment variables
docker-compose -f docker-compose.dev.yml exec backend-postgres env | grep DB_
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# View slow queries (PostgreSQL)
docker-compose -f docker-compose.dev.yml exec postgres psql -U volumeviz -c "SELECT query, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;"

# Check SQLite PRAGMA settings
docker-compose -f docker-compose.dev.yml exec backend-sqlite sqlite3 /data/volumeviz.db "PRAGMA compile_options;"
```

### Reset Environment

```bash
# Complete reset (removes all data)
./scripts/dev-stop.sh --clean
docker system prune -f
./scripts/dev-start.sh
```

## Development Tips

### Database Schema Changes

1. **Update migration files** in `internal/database/migrations/`
2. **Test with both databases**:
   ```bash
   # PostgreSQL
   curl -X POST http://localhost:8080/api/v1/admin/migrate
   
   # SQLite  
   curl -X POST http://localhost:8081/api/v1/admin/migrate
   ```

### Performance Optimization

1. **Monitor query performance** in Grafana
2. **Use pgAdmin** to analyze PostgreSQL query plans
3. **Use SQLite Web** to view table structures and data
4. **Run benchmarks** regularly with `./scripts/db-benchmark.sh`

### Testing Strategies

1. **Unit tests** run against both database types
2. **Integration tests** can target specific databases
3. **Performance tests** compare database backends
4. **Load tests** validate concurrent usage patterns

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Frontend      │
│  (PostgreSQL)   │    │   (SQLite)      │
│   Port 5173     │    │   Port 5174     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│   Backend       │    │   Backend       │
│  (PostgreSQL)   │    │   (SQLite)      │
│   Port 8080     │    │   Port 8081     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   SQLite File   │
│   Port 5432     │    │  (Volume Mount) │
└─────────────────┘    └─────────────────┘
          │                      │
          ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│     pgAdmin     │    │   SQLite Web    │
│   Port 5050     │    │   Port 8082     │
└─────────────────┘    └─────────────────┘
                │                      │
                └──────────┬───────────┘
                           ▼
                ┌─────────────────┐
                │   Monitoring    │
                │ Prometheus/Graf │
                │ Ports 9090/3000 │
                └─────────────────┘
```

This development environment provides a comprehensive platform for testing, comparing, and optimizing both PostgreSQL and SQLite implementations in VolumeViz.