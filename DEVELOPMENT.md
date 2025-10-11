# Development Guide

## Hot Reloading

### Backend (Go)

**✅ Hot reloading is now enabled by default!**

The backend uses [Air](https://github.com/cosmtrek/air) for automatic hot reloading.

**How it works:**
1. Edit any `.go` file
2. Air detects the change
3. Code rebuilds automatically (~2 seconds)
4. Server restarts with new code
5. No manual intervention needed!

**What you should see:**
```bash
$ docker logs volumeviz-api
watching .
watching internal
watching internal/api
building...
running...
# Edit a file...
building...  # ← Automatic rebuild!
running...
```

**No more:**
- ❌ `make build && docker cp volumeviz volumeviz-api:/app/volumeviz && docker restart volumeviz-api`
- ❌ `docker-compose up -d --build api`
- ❌ Manual binary copying
- ❌ Container restarts

**Just:**
- ✅ Save your file
- ✅ Wait ~2 seconds
- ✅ Test your changes

### Frontend (React + Vite)

**Already enabled** - Vite hot module replacement (HMR) works out of the box.

- Edit any `.tsx`, `.ts`, `.css` file
- Browser updates instantly
- State preserved during updates

## Quick Start

### Start Everything

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database
- Backend API (with Air hot reloading)
- Frontend dev server (with Vite HMR)

### Watch Logs

```bash
# Backend
docker logs -f volumeviz-api

# Frontend
docker logs -f volumeviz-web

# All services
docker-compose logs -f
```

### Make Changes

**Backend:**
1. Edit `internal/api/v1/explorer/handler.go`
2. Save file
3. Watch logs: `building... running...`
4. Test: `curl http://localhost:8080/api/v1/health`

**Frontend:**
1. Edit `frontend/src/pages/ExplorerPage/ExplorerPage.tsx`
2. Save file
3. Browser auto-refreshes
4. Test: Visit `http://localhost:5173/files`

## Configuration

### Air Configuration

Located in `.air.toml`:

```toml
[build]
  cmd = "go build -buildvcs=false -a -o ./tmp/main ./cmd/server"
  bin = "./tmp/main"
  delay = 1000  # Wait 1s before rebuilding
  exclude_dir = ["frontend", "docs", "tmp"]
```

### Environment Variables

**Development (default):**
```bash
DOCKERFILE=Dockerfile.dev  # Uses Air
BACKEND_COMMAND=air        # Runs Air
GIN_MODE=debug            # Verbose logging
```

**Production:**
```bash
DOCKERFILE=Dockerfile
BACKEND_COMMAND=/app/volumeviz
GIN_MODE=release
```

## Troubleshooting

### "Hot reload not working"

**Check Air is running:**
```bash
docker logs volumeviz-api | grep "watching"
```

You should see:
```
watching .
watching internal
watching cmd
```

If not, rebuild:
```bash
docker-compose up -d --build api
```

### "Changes not detected"

**Verify source code is mounted:**
```bash
docker inspect volumeviz-api | grep -A 5 Mounts
```

You should see:
```json
{
  "Source": "/home/user/volumeviz",
  "Destination": "/app",
  "Mode": "rw"
}
```

If not, check `docker-compose.yml`:
```yaml
volumes:
  - .:/app  # ← Must be present
```

### "Build errors"

**Check Air logs:**
```bash
docker exec volumeviz-api cat /app/build-errors.log
```

**Common issues:**
- Missing imports: `go mod tidy`
- Syntax errors: Check the error message
- Cache issues: `docker-compose down && docker-compose up -d --build`

### "Slow rebuilds"

Air caches Go modules and builds:
- First build: ~10-15 seconds
- Subsequent builds: ~2-3 seconds

If builds are slow:
```bash
# Clear Go cache
docker exec volumeviz-api rm -rf /tmp/gocache/* /tmp/gomodcache/*
```

## Tips

### Fast Feedback Loop

1. **Run tests on save** (terminal 1):
   ```bash
   docker exec volumeviz-api sh -c 'while true; do go test ./internal/...; sleep 2; done'
   ```

2. **Watch logs** (terminal 2):
   ```bash
   docker logs -f volumeviz-api
   ```

3. **Edit code** (terminal 3):
   ```bash
   vim internal/api/v1/explorer/handler.go
   ```

### Debugging

**Add debug logs:**
```go
log.Printf("[DEBUG] Variable value: %+v", variable)
```

**Watch logs:**
```bash
docker logs -f volumeviz-api | grep DEBUG
```

### Performance

**Air config optimization** (`.air.toml`):
```toml
[build]
  delay = 500  # Faster rebuilds (be careful with rapid saves)
  exclude_unchanged = true  # Only rebuild changed packages
```

## Development Workflow

### Typical Development Session

```bash
# 1. Start services
docker-compose up -d

# 2. Watch backend logs
docker logs -f volumeviz-api

# 3. Make changes to Go code
vim internal/api/v1/explorer/handler.go

# 4. Air automatically rebuilds (watch logs)
# building...
# running...

# 5. Test changes
curl http://localhost:8080/api/v1/explorer/browse?volume_id=test

# 6. Iterate quickly!
# Edit → Save → Wait 2s → Test → Repeat
```

### No More:

❌ **Old painful workflow:**
```bash
# Edit code
vim handler.go

# Build locally
make build

# Copy binary
docker cp volumeviz volumeviz-api:/app/volumeviz

# Restart container
docker restart volumeviz-api

# Wait 10 seconds...

# Test
curl localhost:8080/api/v1/...

# Find bug, repeat process... 😭
```

✅ **New smooth workflow:**
```bash
# Edit code
vim handler.go

# Save file (Air does the rest!)

# Test (2 seconds later)
curl localhost:8080/api/v1/...

# 🎉
```

## Advanced

### Custom Air Command

Override in docker-compose.override.yml:
```yaml
services:
  api:
    command: air -c .air.custom.toml
```

### Disable Hot Reload (Production Mode)

```bash
# Use production Dockerfile
DOCKERFILE=Dockerfile docker-compose up -d api
```

Or set in `.env`:
```
DOCKERFILE=Dockerfile
BACKEND_COMMAND=/app/volumeviz
```

### Multiple Backend Instances

Edit `.air.toml` to use different ports:
```toml
[build]
  bin = "./tmp/main"
  args_bin = ["-port", "8081"]
```

## See Also

- [Air Documentation](https://github.com/cosmtrek/air)
- [Docker Compose Override](https://docs.docker.com/compose/extends/)
- [Go Build Cache](https://pkg.go.dev/cmd/go#hdr-Build_and_test_caching)
