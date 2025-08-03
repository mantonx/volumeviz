# Development Environment Summary

## 🎉 What We've Built

A comprehensive Docker Compose development environment that allows you to:

✅ **Test both PostgreSQL and SQLite backends simultaneously**  
✅ **Visualize databases with industry-standard tools**  
✅ **Monitor performance with Grafana and Prometheus**  
✅ **Compare database performance in real-time**  
✅ **Run automated benchmarks**  

## 🚀 Quick Start

```bash
# Start everything (PostgreSQL + SQLite + Monitoring)
./scripts/dev-start.sh

# Or start specific stacks
./scripts/dev-start.sh --profile postgres  # PostgreSQL only
./scripts/dev-start.sh --profile sqlite    # SQLite only
./scripts/dev-start.sh --profile minimal   # Fast startup
```

## 📊 Available Services

| Service | URL | Purpose | Credentials |
|---------|-----|---------|-------------|
| **VolumeViz (PostgreSQL)** | http://localhost:8080 | API with PostgreSQL backend | - |
| **VolumeViz (SQLite)** | http://localhost:8081 | API with SQLite backend | - |
| **Frontend (PostgreSQL)** | http://localhost:5173 | Web UI → PostgreSQL API | - |
| **Frontend (SQLite)** | http://localhost:5174 | Web UI → SQLite API | - |
| **pgAdmin** | http://localhost:5050 | PostgreSQL database admin | dev@volumeviz.com / volumeviz |
| **SQLite Web** | http://localhost:8082 | SQLite database browser | - |
| **Grafana** | http://localhost:3000 | Performance dashboards | admin / volumeviz |
| **Prometheus** | http://localhost:9090 | Metrics collection | - |

## ⚡ Performance Testing

```bash
# Run automated benchmark comparing both databases
./scripts/db-benchmark.sh

# View real-time performance metrics
open http://localhost:3000  # Grafana dashboard

# Check database optimizations
curl http://localhost:8080/health  # PostgreSQL backend
curl http://localhost:8081/health  # SQLite backend
```

## 🔧 Database Optimizations Applied

### PostgreSQL (Automatic)
- **100 concurrent connections** with connection pooling
- **30+ session-level optimizations** (work_mem, JIT, parallel queries)
- **SSD-optimized settings** (random_page_cost, effective_io_concurrency)
- **Advanced features** (extended statistics, query planner optimizations)

### SQLite (Automatic)  
- **WAL mode** for better concurrency and crash recovery
- **64MB cache + 256MB memory-mapped I/O** for performance
- **4KB page size** optimized for modern SSDs
- **12+ PRAGMA optimizations** applied automatically

## 🎯 Use Cases

### Side-by-Side Comparison
1. Open both frontends in different browser windows
2. Perform the same operations on both backends
3. Compare response times and behavior
4. View database differences in pgAdmin vs SQLite Web

### Performance Analysis
1. Run `./scripts/db-benchmark.sh` for automated benchmarks
2. Use Grafana to view real-time metrics comparison
3. Analyze query performance in database tools
4. Test concurrent load scenarios

### Development Workflows
- **PostgreSQL development**: Full SQL features, complex queries, high concurrency
- **SQLite development**: Simplified deployment, single-file database, development speed
- **Migration testing**: Test schema changes on both database types
- **Performance optimization**: Compare query execution plans and optimize

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Environment                    │
├─────────────────────┬───────────────────────────────────────┤
│   PostgreSQL Stack │             SQLite Stack              │
│                     │                                       │
│  Frontend :5173 ────┼──── Frontend :5174                   │
│      │              │         │                            │
│      ▼              │         ▼                            │
│  Backend  :8080 ────┼──── Backend  :8081                   │
│      │              │         │                            │
│      ▼              │         ▼                            │
│  PostgreSQL :5432 ──┼──── SQLite File                      │
│      │              │         │                            │
│      ▼              │         ▼                            │
│  pgAdmin  :5050 ────┼──── SQLite Web :8082                 │
└─────────────────────┴───────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │         Monitoring Stack           │
            │                                   │
            │  Prometheus :9090 ── Grafana :3000 │
            └─────────────────────────────────────┘
```

## 🛠️ Management Commands

```bash
# View logs
docker-compose -f docker-compose.dev.yml logs -f [service]

# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend-postgres

# Scale services (PostgreSQL only - SQLite is single-connection)
docker-compose -f docker-compose.dev.yml up -d --scale backend-postgres=2

# Stop everything
./scripts/dev-stop.sh

# Clean reset (removes all data)
./scripts/dev-stop.sh --clean
```

## 💡 Development Tips

1. **Use different browser profiles** to test both databases simultaneously
2. **Monitor Grafana** to see real-time performance differences  
3. **Check database tools** (pgAdmin/SQLite Web) to view actual data structure
4. **Run benchmarks regularly** to validate performance optimizations
5. **Test migrations** on both database types before deployment

## 🔍 What's Optimized

- **Connection strings** with performance parameters
- **Database-specific settings** applied automatically  
- **Query planner optimizations** for both database types
- **Memory settings** tuned for development workloads
- **Monitoring** with comprehensive metrics collection
- **Development workflow** with easy startup/shutdown scripts

This environment provides everything you need to develop, test, and optimize VolumeViz with both PostgreSQL and SQLite backends! 🚀