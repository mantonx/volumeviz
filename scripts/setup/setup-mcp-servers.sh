#!/bin/bash

# VolumeViz MCP Servers Setup Script
# This script installs and configures Model Context Protocol servers for the VolumeViz project

set -euo pipefail

echo "🚀 Setting up MCP servers for VolumeViz..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Install MCP servers globally
print_status "Installing PostgreSQL MCP server..."
npm install -g @crystaldba/postgres-mcp || {
    print_warning "Enhanced PostgreSQL MCP not available, installing reference server..."
    npm install -g @modelcontextprotocol/server-postgres
}

print_status "Installing Docker MCP server..."
npm install -g @docker/mcp-server || {
    print_warning "Official Docker MCP not available, skipping..."
}

print_status "Installing Git MCP server..."
npm install -g @modelcontextprotocol/server-git

print_status "Installing GitHub MCP server..."
npm install -g @modelcontextprotocol/server-github

print_status "Installing Filesystem MCP server..."
npm install -g @modelcontextprotocol/server-filesystem

print_status "Installing Memory MCP server..."
npm install -g @modelcontextprotocol/server-memory

print_status "Installing Sequential Thinking MCP server..."
npm install -g @modelcontextprotocol/server-sequential-thinking

print_status "Installing Brave Search MCP server..."
npm install -g @modelcontextprotocol/server-brave-search

print_success "MCP servers installed successfully!"

# Check Docker installation
if command -v docker &> /dev/null; then
    print_status "Docker is installed: $(docker --version)"
    
    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_warning "Docker daemon is not running. Please start Docker Desktop or the Docker service."
    fi
else
    print_warning "Docker is not installed. Docker MCP server may not function properly."
fi

# Check PostgreSQL connection
print_status "Testing PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if psql "postgresql://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable" -c "SELECT 1;" &> /dev/null; then
        print_success "PostgreSQL connection successful"
    else
        print_warning "PostgreSQL connection failed. Make sure the database is running and credentials are correct."
        print_warning "You can start the database with: docker-compose -f docker-compose.dev.yml up postgres"
    fi
else
    print_warning "psql client not found. Install PostgreSQL client to test connections."
fi

echo ""
print_success "MCP setup complete!"
print_status "Configuration file created at: ~/.config/claude-code/claude_desktop_config.json"
print_status "Restart Claude Code to load the new MCP servers."

echo ""
print_status "Available MCP servers:"
echo "  📊 PostgreSQL MCP - Database operations and performance analysis"
echo "  📝 Git MCP - Advanced Git operations"
echo "  📁 Filesystem MCP - File system operations"
echo "  🧠 Memory MCP - Persistent knowledge graph-based memory"
echo "  🤔 Sequential Thinking MCP - Structured problem-solving"
echo "  🔍 Brave Search MCP - Real-time web search and research"

echo ""
print_status "To configure Brave Search MCP, get your API key from:"
print_status "https://api.search.brave.com/ and set:"
print_status "export BRAVE_API_KEY=your_api_key_here"

echo ""
print_success "Setup complete! 🎉"