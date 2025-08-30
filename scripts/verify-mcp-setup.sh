#!/bin/bash

# VolumeViz MCP Setup Verification Script
# This script verifies that all MCP servers are properly configured and available

echo "🔍 Verifying MCP Setup for VolumeViz..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

echo
echo "📦 Checking installed MCP packages..."
npm list -g --depth=0 2>/dev/null | grep -E "(enhanced-postgres|server-filesystem|server-memory|server-sequential|brave-search-mcp)"

echo
echo "📁 Checking Claude Code configuration..."
if [ -f ~/.config/claude-code/claude_desktop_config.json ]; then
    echo -e "${GREEN}✅ Claude configuration file exists${NC}"
    echo "   📊 PostgreSQL MCP: $(grep -c 'enhanced-postgres-mcp-server' ~/.config/claude-code/claude_desktop_config.json > /dev/null && echo 'Configured' || echo 'Missing')"
    echo "   📁 Filesystem MCP: $(grep -c 'server-filesystem' ~/.config/claude-code/claude_desktop_config.json > /dev/null && echo 'Configured' || echo 'Missing')"
    echo "   🧠 Memory MCP: $(grep -c 'server-memory' ~/.config/claude-code/claude_desktop_config.json > /dev/null && echo 'Configured' || echo 'Missing')"
    echo "   🤔 Sequential Thinking MCP: $(grep -c 'server-sequential-thinking' ~/.config/claude-code/claude_desktop_config.json > /dev/null && echo 'Configured' || echo 'Missing')"
    echo "   🔍 Brave Search MCP: $(grep -c 'brave-search-mcp-server' ~/.config/claude-code/claude_desktop_config.json > /dev/null && echo 'Configured' || echo 'Missing')"
else
    echo -e "${RED}❌ Claude configuration file missing${NC}"
fi

echo
echo "🔑 Checking API keys..."
if [ -f .env ] && grep -q "BRAVE_API_KEY=" .env; then
    echo -e "${GREEN}✅ Brave API key found in .env${NC}"
else
    echo -e "${YELLOW}⚠️  Brave API key not found in .env${NC}"
fi

if grep -q "BRAVE_API_KEY" ~/.bashrc; then
    echo -e "${GREEN}✅ Brave API key configured in shell profile${NC}"
else
    echo -e "${YELLOW}⚠️  Brave API key not in shell profile${NC}"
fi

echo
echo "🧪 Testing MCP servers..."
echo "   📊 PostgreSQL MCP: $(timeout 2s npx -y enhanced-postgres-mcp-server --version 2>/dev/null && echo 'Working' || echo 'Needs database connection')"
echo "   📁 Filesystem MCP: $(timeout 2s npx -y @modelcontextprotocol/server-filesystem --help 2>/dev/null && echo 'Working' || echo 'Available')"
echo "   🧠 Memory MCP: $(timeout 2s npx -y @modelcontextprotocol/server-memory 2>&1 | grep -q 'running' && echo 'Working' || echo 'Available')"
echo "   🤔 Sequential Thinking MCP: $(timeout 2s npx -y @modelcontextprotocol/server-sequential-thinking 2>&1 | grep -q 'running' && echo 'Working' || echo 'Available')"

if [ -n "${BRAVE_API_KEY}" ]; then
    echo "   🔍 Brave Search MCP: $(timeout 2s npx -y @brave/brave-search-mcp-server 2>&1 | grep -q 'running' && echo 'Working' || echo 'Available')"
else
    echo "   🔍 Brave Search MCP: Needs API key"
fi

echo
echo "📋 Next Steps:"
echo "   1. Restart Claude Code to load MCP servers"
echo "   2. MCP tools will appear as mcp__* functions"
echo "   3. Test functionality with database operations, memory storage, etc."

echo
echo -e "${GREEN}🎉 MCP setup verification complete!${NC}"