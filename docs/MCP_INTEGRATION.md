# Model Context Protocol (MCP) Integration

This document describes the MCP server configuration for the VolumeViz project, enabling Claude Code to interact directly with your development environment.

## Overview

Model Context Protocol (MCP) allows Claude Code to connect to external tools and data sources. VolumeViz uses several MCP servers to streamline development workflows:

- **PostgreSQL MCP**: Database operations, schema inspection, query optimization
- **Git MCP**: Advanced Git operations, repository analysis
- **Filesystem MCP**: File system operations within project boundaries
- **Memory MCP**: Persistent knowledge graph-based memory across sessions
- **Sequential Thinking MCP**: Structured problem-solving and reflective analysis
- **Brave Search MCP**: Real-time web search for technical research and documentation

## Installation

### Quick Setup
```bash
# Run the automated setup script (installs packages)
./scripts/setup/setup-mcp-servers.sh

# Verify the setup is complete
./scripts/verify-mcp-setup.sh
```

### ✅ Current Status
All MCP servers are **installed and configured** for VolumeViz:
- ✅ **PostgreSQL MCP** - `enhanced-postgres-mcp-server` 
- ✅ **Filesystem MCP** - `@modelcontextprotocol/server-filesystem`
- ✅ **Memory MCP** - `@modelcontextprotocol/server-memory`
- ✅ **Sequential Thinking MCP** - `@modelcontextprotocol/server-sequential-thinking` 
- ✅ **Brave Search MCP** - `@brave/brave-search-mcp-server`
- ✅ **IDE Integration MCPs** - Diagnostics and Code Execution

### Manual Installation
```bash
# Core Development MCPs
npm install -g @modelcontextprotocol/server-postgres
npm install -g @modelcontextprotocol/server-git
npm install -g @modelcontextprotocol/server-filesystem

# Memory & Thinking MCPs
npm install -g @modelcontextprotocol/server-memory
npm install -g @modelcontextprotocol/server-sequential-thinking

# Research & Documentation MCPs
npm install -g @modelcontextprotocol/server-brave-search
```

## Configuration

The MCP configuration is located at `~/.config/claude-code/claude_desktop_config.json`:

### PostgreSQL MCP Server
```json
{
  "volumeviz-postgres": {
    "command": "npx",
    "args": ["-y", "@crystaldba/postgres-mcp", "postgresql://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable"],
    "env": {
      "POSTGRES_READ_ONLY": "false",
      "POSTGRES_ANALYZE_QUERIES": "true",
      "POSTGRES_EXPLAIN_PLANS": "true"
    }
  }
}
```

**Features:**
- Execute SQL queries with safety controls
- Database health monitoring
- Index analysis and tuning recommendations
- Query plan optimization
- Schema inspection

### Docker MCP Server
```json
{
  "volumeviz-docker": {
    "command": "npx", 
    "args": ["-y", "@docker/mcp-server", "--compose-file", "/home/fictional/Projects/volumeviz/docker-compose.dev.yml"],
    "env": {
      "DOCKER_HOST": "unix:///var/run/docker.sock"
    }
  }
}
```

**Features:**
- Container lifecycle management
- Service health monitoring
- Log streaming and analysis
- Docker Compose integration
- Resource usage monitoring

### Git MCP Server
```json
{
  "volumeviz-git": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-git", "/home/fictional/Projects/volumeviz"]
  }
}
```

**Features:**
- Advanced Git operations
- Branch analysis and management
- Commit history exploration
- Merge conflict resolution
- Repository statistics

### GitHub MCP Server
```json
{
  "volumeviz-github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": ""
    }
  }
}
```

**Setup GitHub Token:**
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

**Features:**
- Pull request management
- Issue tracking and creation
- Workflow monitoring
- Release management
- Repository analytics

### Memory MCP Server
```json
{
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"]
  }
}
```

**Features:**
- Knowledge graph-based persistent memory
- Entity-relationship tracking across sessions
- Cross-conversation context retention
- Automatic memory consolidation
- Searchable project knowledge base

### Sequential Thinking MCP Server
```json
{
  "sequential-thinking": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
  }
}
```

**Features:**
- Structured step-by-step problem solving
- Dynamic and reflective analysis
- Complex debugging workflows
- Multi-stage planning capabilities
- Thought process documentation

### Brave Search MCP Server
```json
{
  "brave-search": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-brave-search"],
    "env": {
      "BRAVE_API_KEY": ""
    }
  }
}
```

**Setup Brave API Key:**
1. Visit [Brave Search API](https://api.search.brave.com/) to get your API key
2. Set the environment variable:
```bash
export BRAVE_API_KEY=your_api_key_here
```

**Features:**
- Real-time web search capabilities
- Technical documentation lookup
- Code example and solution research
- Performance optimization techniques
- Format and codec compatibility research

## Usage Examples

### Database Operations
With PostgreSQL MCP, Claude Code can:
```sql
-- Analyze table performance
SELECT * FROM pg_stat_user_tables WHERE relname = 'files';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM files WHERE size > 1000000;
```

### Container Management
With Docker MCP, Claude Code can:
```bash
# Check service status
docker-compose -f docker-compose.dev.yml ps

# View service logs
docker-compose -f docker-compose.dev.yml logs backend

# Monitor resource usage
docker stats
```

### Memory & Thinking Operations
With Memory and Sequential Thinking MCPs, Claude Code can:
```
# Store project knowledge
Remember: "VolumeViz incremental walker uses 3 phases: Preparation, Database Reconciliation, and Filesystem Walking"

# Retrieve context
Recall: "What was the solution to the 28,308 file indexing hang?"

# Structured problem solving
Think through: "How to optimize PostgreSQL query performance for large file counts?"
```

### Research Operations  
With Brave Search MCP, Claude Code can:
```
# Technical research
Search: "Go filesystem walking performance optimization 2025"
Search: "PostgreSQL bulk insert performance tuning"
Search: "ffmpeg codec compatibility H.264 vs H.265"

# Documentation lookup
Search: "Docker Compose development best practices"
Search: "Go context cancellation patterns"
```

### Enhanced Development Workflow
Combined MCP servers enable Claude Code to:
1. **Analyze database performance** during development
2. **Remember architectural decisions** across sessions
3. **Structure complex problem solving** with step-by-step analysis
4. **Research solutions** in real-time without leaving the development context
5. **Manage Git workflows** with advanced operations
6. **Navigate and modify** project files safely
7. **Build persistent knowledge** about the VolumeViz codebase

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Test database connection
psql "postgresql://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable" -c "SELECT 1;"

# Start database if not running
docker-compose -f docker-compose.dev.yml up postgres
```

### Docker Socket Permission Issues
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER

# Restart session or run
newgrp docker
```

### MCP Server Not Loading
1. Check Claude Code logs for errors
2. Verify MCP servers are installed globally
3. Restart Claude Code application
4. Test MCP server manually:
   ```bash
   npx @crystaldba/postgres-mcp postgresql://localhost/test
   ```

## Security Considerations

### Database Access
- PostgreSQL MCP uses configurable safety controls
- Read-only mode available via `POSTGRES_READ_ONLY=true`
- Transactions are isolated and can be rolled back
- Schema modifications require explicit permissions

### Docker Access
- Limited to compose-file specified services
- No host system access beyond Docker socket
- Container isolation maintained

### GitHub Integration  
- Personal access tokens should use minimal required scopes
- Tokens should be stored securely (not in configuration files)
- Regular token rotation recommended

## Performance Impact

MCP servers run as separate processes and have minimal performance impact:
- **Memory**: ~10-50MB per MCP server
- **CPU**: Minimal when idle, scales with usage
- **Network**: Only active during Claude Code operations

## Advanced Configuration

### Custom PostgreSQL Connection
```json
{
  "volumeviz-postgres-readonly": {
    "command": "npx",
    "args": ["-y", "@crystaldba/postgres-mcp", "postgresql://readonly_user:password@localhost:5432/volumeviz"],
    "env": {
      "POSTGRES_READ_ONLY": "true"
    }
  }
}
```

### Multiple Environment Support
```json
{
  "volumeviz-postgres-dev": {
    "command": "npx",
    "args": ["-y", "@crystaldba/postgres-mcp", "postgresql://volumeviz:volumeviz@localhost:5432/volumeviz"]
  },
  "volumeviz-postgres-staging": {
    "command": "npx", 
    "args": ["-y", "@crystaldba/postgres-mcp", "postgresql://user:pass@staging-host:5432/volumeviz"]
  }
}
```

## Integration with VolumeViz Workflows

### Database Migration Support
Claude Code can now:
- Review migration files before execution
- Monitor migration performance
- Analyze schema changes impact
- Validate migration rollback procedures

### Development Environment Management  
Claude Code can now:
- Start/stop development services
- Monitor service health and logs
- Coordinate multi-service debugging
- Optimize container resource allocation

### CI/CD Integration
Claude Code can now:
- Monitor GitHub Actions workflows
- Manage dependabot PRs automatically  
- Coordinate release processes
- Analyze build performance metrics

---

*This integration transforms Claude Code from a code assistant into a comprehensive development environment partner, capable of managing databases, containers, and workflows alongside code generation and analysis.*