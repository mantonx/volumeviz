# Backend Aggregate API Specification

## Overview
This document provides detailed technical specifications for implementing the aggregate API endpoint required for Treemap and Sunburst visualizations in the VolumeViz Explorer Enhancement.

## API Endpoint Design

### Endpoint: `GET /api/v1/fs/aggregate`

#### Request Parameters
```go
type AggregateRequest struct {
    VolumeID  string `query:"volumeId" validate:"required"`
    Path      string `query:"path" default:"/"`
    MaxDepth  int    `query:"maxDepth" default:"3" validate:"min=1,max=10"`
    Stat      string `query:"stat" default:"size" validate:"oneof=size count"`
    Bucket    string `query:"bucket,omitempty" validate:"omitempty,oneof=modified type extension"`
    MinSize   int64  `query:"minSize,omitempty"`
    Limit     int    `query:"limit" default:"1000" validate:"max=10000"`
}
```

#### Response Structure
```go
type AggregateResponse struct {
    Nodes     []TreeNode       `json:"nodes"`
    Stats     AggregateStats   `json:"stats"`
    Metadata  ResponseMetadata `json:"metadata"`
}

type TreeNode struct {
    ID         string     `json:"id"`
    Name       string     `json:"name"`
    Path       string     `json:"path"`
    ParentPath string     `json:"parentPath,omitempty"`
    Type       string     `json:"type"` // file|directory
    Size       int64      `json:"size"`
    Count      int        `json:"count"`
    Extension  string     `json:"extension,omitempty"`
    MimeType   string     `json:"mimeType,omitempty"`
    Modified   time.Time  `json:"modified"`
    Created    time.Time  `json:"created,omitempty"`
    Children   []TreeNode `json:"children,omitempty"`
    Depth      int        `json:"depth"`
    
    // Visualization hints
    Color      string     `json:"color,omitempty"`
    Opacity    float64    `json:"opacity,omitempty"`
}

type AggregateStats struct {
    TotalSize     int64   `json:"totalSize"`
    TotalCount    int     `json:"totalCount"`
    FileCount     int     `json:"fileCount"`
    DirCount      int     `json:"dirCount"`
    MaxDepth      int     `json:"maxDepth"`
    AvgFileSize   int64   `json:"avgFileSize"`
    MedianSize    int64   `json:"medianSize"`
    LargestFile   *FileRef `json:"largestFile,omitempty"`
    LastModified  time.Time `json:"lastModified"`
}

type ResponseMetadata struct {
    CacheHit      bool      `json:"cacheHit"`
    ComputeTimeMs int64     `json:"computeTimeMs"`
    Timestamp     time.Time `json:"timestamp"`
    Truncated     bool      `json:"truncated"`
}
```

## Database Schema Updates

### New Tables
```sql
-- Cache table for aggregate results
CREATE TABLE aggregate_cache (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    path VARCHAR(4096) NOT NULL,
    max_depth INT NOT NULL,
    stat_type VARCHAR(50) NOT NULL,
    bucket_type VARCHAR(50),
    cache_key VARCHAR(255) GENERATED ALWAYS AS (
        MD5(CONCAT(volume_id, path, max_depth, stat_type, COALESCE(bucket_type, '')))
    ) STORED,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    hit_count INT DEFAULT 0,
    UNIQUE(cache_key)
);

CREATE INDEX idx_aggregate_cache_key ON aggregate_cache(cache_key);
CREATE INDEX idx_aggregate_cache_expires ON aggregate_cache(expires_at);
```

### Optimized Queries

#### Recursive CTE for Tree Aggregation
```sql
WITH RECURSIVE file_tree AS (
    -- Base case: root level
    SELECT 
        f.id,
        f.name,
        f.path,
        f.parent_path,
        f.type,
        f.size,
        f.extension,
        f.mime_type,
        f.modified,
        f.created,
        0 as depth,
        f.path as tree_path
    FROM files f
    WHERE 
        f.volume_id = $1 
        AND f.parent_path = $2
        AND f.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: children
    SELECT 
        f.id,
        f.name,
        f.path,
        f.parent_path,
        f.type,
        f.size,
        f.extension,
        f.mime_type,
        f.modified,
        f.created,
        ft.depth + 1,
        ft.tree_path || '/' || f.name
    FROM files f
    INNER JOIN file_tree ft ON f.parent_path = ft.path
    WHERE 
        f.volume_id = $1
        AND ft.depth < $3  -- max_depth parameter
        AND f.deleted_at IS NULL
),
aggregated AS (
    SELECT 
        ft.*,
        -- Aggregate child counts and sizes
        COALESCE(
            (SELECT COUNT(*) 
             FROM file_tree child 
             WHERE child.parent_path = ft.path),
            0
        ) as child_count,
        COALESCE(
            (SELECT SUM(child.size) 
             FROM file_tree child 
             WHERE child.parent_path = ft.path 
             AND child.type = 'file'),
            0
        ) as children_size
    FROM file_tree ft
)
SELECT 
    a.*,
    CASE 
        WHEN a.type = 'directory' THEN a.children_size
        ELSE a.size
    END as total_size
FROM aggregated a
ORDER BY 
    a.depth,
    a.type DESC, -- directories first
    a.name;
```

## Implementation Details

### Handler Implementation
```go
// internal/api/v1/aggregate/handler.go
package aggregate

import (
    "context"
    "database/sql"
    "encoding/json"
    "net/http"
    "time"
    
    "github.com/go-redis/redis/v8"
    "github.com/labstack/echo/v4"
)

type Handler struct {
    db    *sql.DB
    redis *redis.Client
    cache *AggregateCache
}

func (h *Handler) GetAggregate(c echo.Context) error {
    ctx := c.Request().Context()
    
    // Parse and validate request
    var req AggregateRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, ErrorResponse{
            Error: "Invalid request parameters",
        })
    }
    
    // Check cache first
    cacheKey := h.generateCacheKey(&req)
    if cached, hit := h.cache.Get(ctx, cacheKey); hit {
        return c.JSON(http.StatusOK, cached)
    }
    
    // Compute aggregate
    start := time.Now()
    result, err := h.computeAggregate(ctx, &req)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, ErrorResponse{
            Error: "Failed to compute aggregate",
        })
    }
    
    // Build response
    response := AggregateResponse{
        Nodes: result.Nodes,
        Stats: result.Stats,
        Metadata: ResponseMetadata{
            CacheHit:      false,
            ComputeTimeMs: time.Since(start).Milliseconds(),
            Timestamp:     time.Now(),
            Truncated:     len(result.Nodes) >= req.Limit,
        },
    }
    
    // Cache result
    h.cache.Set(ctx, cacheKey, response, 5*time.Minute)
    
    return c.JSON(http.StatusOK, response)
}

func (h *Handler) computeAggregate(ctx context.Context, req *AggregateRequest) (*AggregateResult, error) {
    // Build and execute query
    query := h.buildAggregateQuery(req)
    rows, err := h.db.QueryContext(ctx, query, req.VolumeID, req.Path, req.MaxDepth)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    // Build tree structure
    nodes := make(map[string]*TreeNode)
    var rootNodes []TreeNode
    
    for rows.Next() {
        var node TreeNode
        if err := h.scanNode(rows, &node); err != nil {
            return nil, err
        }
        
        nodes[node.Path] = &node
        
        if node.ParentPath == req.Path {
            rootNodes = append(rootNodes, node)
        } else if parent, ok := nodes[node.ParentPath]; ok {
            parent.Children = append(parent.Children, node)
        }
    }
    
    // Calculate stats
    stats := h.calculateStats(nodes)
    
    return &AggregateResult{
        Nodes: rootNodes,
        Stats: stats,
    }, nil
}
```

### Caching Strategy
```go
// internal/services/cache/aggregate_cache.go
package cache

import (
    "context"
    "encoding/json"
    "fmt"
    "time"
    
    "github.com/go-redis/redis/v8"
)

type AggregateCache struct {
    redis *redis.Client
    ttl   time.Duration
}

func (c *AggregateCache) Get(ctx context.Context, key string) (*AggregateResponse, bool) {
    data, err := c.redis.Get(ctx, key).Bytes()
    if err != nil {
        return nil, false
    }
    
    var response AggregateResponse
    if err := json.Unmarshal(data, &response); err != nil {
        return nil, false
    }
    
    response.Metadata.CacheHit = true
    return &response, true
}

func (c *AggregateCache) Set(ctx context.Context, key string, response *AggregateResponse, ttl time.Duration) error {
    data, err := json.Marshal(response)
    if err != nil {
        return err
    }
    
    return c.redis.Set(ctx, key, data, ttl).Err()
}

func (c *AggregateCache) Invalidate(ctx context.Context, volumeID string) error {
    pattern := fmt.Sprintf("aggregate:%s:*", volumeID)
    keys, err := c.redis.Keys(ctx, pattern).Result()
    if err != nil {
        return err
    }
    
    if len(keys) > 0 {
        return c.redis.Del(ctx, keys...).Err()
    }
    
    return nil
}
```

### WebSocket Integration
```go
// Broadcast aggregate updates when files change
func (h *Handler) handleFileChange(ctx context.Context, event FileChangeEvent) {
    // Invalidate cache for affected volume
    h.cache.Invalidate(ctx, event.VolumeID)
    
    // Broadcast update to connected clients
    h.broadcaster.Send(WebSocketMessage{
        Type: "aggregate.invalidated",
        Data: map[string]interface{}{
            "volumeId": event.VolumeID,
            "path":     event.Path,
        },
    })
}
```

## Performance Optimizations

### 1. Query Optimization
- Use materialized views for frequently accessed aggregates
- Partial indexes on volume_id + path combinations
- Parallel query execution for large datasets

### 2. Caching Layers
- **L1**: In-memory LRU cache (10MB, 1min TTL)
- **L2**: Redis cache (100MB, 5min TTL)
- **L3**: Database cache table (1GB, 1hour TTL)

### 3. Incremental Loading
```go
// Support incremental depth expansion
func (h *Handler) ExpandNode(c echo.Context) error {
    nodePath := c.QueryParam("path")
    depth := c.QueryParam("depth")
    
    // Load only immediate children
    children, err := h.loadChildren(nodePath, 1)
    if err != nil {
        return err
    }
    
    return c.JSON(http.StatusOK, children)
}
```

## Testing Strategy

### Unit Tests
```go
func TestAggregateHandler_GetAggregate(t *testing.T) {
    tests := []struct {
        name     string
        request  AggregateRequest
        expected int // expected node count
    }{
        {
            name: "shallow depth",
            request: AggregateRequest{
                VolumeID: "test-volume",
                MaxDepth: 1,
            },
            expected: 10,
        },
        {
            name: "deep recursion",
            request: AggregateRequest{
                VolumeID: "test-volume",
                MaxDepth: 5,
            },
            expected: 1000,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Performance Benchmarks
```go
func BenchmarkAggregate(b *testing.B) {
    scenarios := []struct {
        name  string
        files int
    }{
        {"small", 100},
        {"medium", 10000},
        {"large", 100000},
    }
    
    for _, s := range scenarios {
        b.Run(s.name, func(b *testing.B) {
            // Benchmark implementation
        })
    }
}
```

## Monitoring & Metrics

### Prometheus Metrics
```go
var (
    aggregateRequests = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "volumeviz_aggregate_requests_total",
            Help: "Total number of aggregate requests",
        },
        []string{"volume_id", "cache_hit"},
    )
    
    aggregateDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "volumeviz_aggregate_duration_seconds",
            Help: "Aggregate computation duration",
        },
        []string{"volume_id", "depth"},
    )
)
```

### Logging
```go
logger.Info("Aggregate request",
    zap.String("volumeId", req.VolumeID),
    zap.String("path", req.Path),
    zap.Int("maxDepth", req.MaxDepth),
    zap.Int64("computeTimeMs", computeTime),
    zap.Bool("cacheHit", cacheHit),
)
```

## Security Considerations

1. **Path Traversal Prevention**: Validate all paths are within volume boundaries
2. **Rate Limiting**: Implement per-user rate limits for expensive aggregations
3. **Query Timeout**: Set maximum execution time for recursive queries
4. **Resource Limits**: Cap maximum depth and result size

## Migration Plan

1. Deploy new endpoint behind feature flag
2. Test with subset of volumes
3. Monitor performance metrics
4. Gradually enable for all users
5. Deprecate old endpoints after 30 days

---

*This specification provides the foundation for implementing the aggregate API required for advanced visualizations in the VolumeViz Explorer Enhancement project.*