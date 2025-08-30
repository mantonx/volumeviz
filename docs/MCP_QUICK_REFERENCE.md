# MCP Quick Reference Guide

## 🚀 VolumeViz MCP Servers Overview

This is a quick reference for the Model Context Protocol (MCP) servers configured for VolumeViz development.

## 📊 **PostgreSQL MCP**
```
✨ Database operations, schema inspection, query optimization
🔗 Direct connection to VolumeViz database
```

**Common Operations:**
- `SELECT * FROM files LIMIT 10` - Query file entries
- `EXPLAIN ANALYZE SELECT ...` - Performance analysis
- `\d table_name` - Schema inspection

## 📝 **Git MCP**
```
✨ Advanced Git operations within VolumeViz repository
🔗 Repository analysis, branch management
```

**Common Operations:**
- Branch analysis and comparisons
- Commit history exploration
- Merge conflict resolution
- Repository statistics and insights

## 📁 **Filesystem MCP**
```
✨ Safe file system operations within project boundaries
🔗 Project-scoped file navigation and modification
```

**Common Operations:**
- Navigate project structure
- Read/modify files safely
- Search within project files
- Directory operations

## 🧠 **Memory MCP**
```
✨ Persistent knowledge graph-based memory across sessions
🔗 Remember project decisions, patterns, and solutions
```

**Key Capabilities:**
- **Entity Storage**: Remember components, functions, decisions
- **Relationship Tracking**: Link related concepts and solutions
- **Cross-Session Context**: Retain knowledge between conversations
- **Searchable Knowledge**: Query past decisions and solutions

**Usage Examples:**
```
Remember: "VolumeViz incremental walker solves UI freeze by using 3 phases"
Remember: "PostgreSQL bulk insert optimization uses COPY FROM for 10x performance"
Recall: "What was the solution to the 28,308 file indexing hang?"
```

## 🤔 **Sequential Thinking MCP**
```
✨ Structured step-by-step problem solving and reflective analysis
🔗 Complex debugging workflows and multi-stage planning
```

**Key Capabilities:**
- **Structured Analysis**: Break down complex problems into steps
- **Reflective Problem Solving**: Analyze solutions and alternatives
- **Dynamic Planning**: Adapt strategies based on new information
- **Thought Documentation**: Record reasoning for future reference

**Usage Examples:**
```
Think through: "How to optimize PostgreSQL query performance for large file counts?"
Analyze: "What are the trade-offs between SQLite and PostgreSQL for VolumeViz?"
Plan: "Multi-phase migration strategy for package restructuring"
```

## 🔍 **Brave Search MCP**
```
✨ Real-time web search for technical research and documentation
🔗 Code examples, solutions, and compatibility research
```

**Key Capabilities:**
- **Technical Research**: Find latest solutions and best practices
- **Documentation Lookup**: Access real-time technical documentation
- **Code Examples**: Discover implementation patterns and examples
- **Compatibility Research**: Check format/codec support and compatibility

**Usage Examples:**
```
Search: "Go filesystem walking performance optimization 2025"
Search: "PostgreSQL bulk insert performance tuning"
Search: "ffmpeg codec compatibility H.264 vs H.265"
Search: "Docker Compose development best practices"
```

## 🔧 **Setup Requirements**

### Brave Search API Key
```bash
# Get API key from: https://api.search.brave.com/
export BRAVE_API_KEY=your_api_key_here
```

### Configuration Location
```
~/.config/claude-code/claude_desktop_config.json
```

### Restart Required
After configuration changes, restart Claude Code to load new MCP servers.

## 🎯 **VolumeViz-Specific Use Cases**

### Database Optimization
```
1. Query performance analysis with PostgreSQL MCP
2. Remember optimization patterns with Memory MCP
3. Research best practices with Brave Search MCP
4. Structure optimization plan with Sequential Thinking MCP
```

### Complex Bug Resolution
```
1. Analyze code patterns with Git MCP
2. Remember previous solutions with Memory MCP
3. Research similar issues with Brave Search MCP
4. Plan debugging approach with Sequential Thinking MCP
5. Navigate codebase with Filesystem MCP
```

### Architecture Planning
```
1. Remember architectural decisions with Memory MCP
2. Structure planning process with Sequential Thinking MCP
3. Research patterns and practices with Brave Search MCP
4. Analyze current implementation with Git/Filesystem MCPs
```

### Performance Investigation
```
1. Query database metrics with PostgreSQL MCP
2. Remember performance baselines with Memory MCP
3. Research optimization techniques with Brave Search MCP
4. Plan performance improvements with Sequential Thinking MCP
```

## 🚀 **Benefits for VolumeViz Development**

- **🧠 Persistent Context**: Never lose architectural decisions or solutions
- **🔍 Real-time Research**: Access latest documentation and solutions instantly
- **🎯 Structured Problem Solving**: Tackle complex issues systematically
- **📊 Database Insights**: Direct access to performance data and analytics
- **📝 Repository Intelligence**: Advanced Git operations and analysis
- **🔒 Safe Operations**: Project-scoped file system access with safety controls

---

*This integration transforms Claude Code into a comprehensive development environment partner with persistent memory, structured thinking, and real-time research capabilities - perfectly suited for VolumeViz's complexity!*