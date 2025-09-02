#!/bin/bash

# Claude Auto-Lint Script
# Automatically fixes linting issues after code changes

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Claude Auto-Lint: Starting automatic code formatting...${NC}"

# Check if frontend service is running
if ! docker-compose ps frontend | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  Frontend service not running. Starting it first...${NC}"
    docker-compose -f docker-compose.dev.yml up -d frontend
    echo -e "${GREEN}✅ Frontend service started${NC}"
    sleep 3
fi

# Function to lint specific files or directories
lint_target() {
    local target=$1
    
    if [ -n "$target" ]; then
        echo -e "${BLUE}🎯 Linting specific target: $target${NC}"
        docker-compose exec -T frontend npm run lint:fix -- "$target" 2>/dev/null || {
            echo -e "${YELLOW}⚠️  ESLint fix had issues, running type-check...${NC}"
            docker-compose exec -T frontend npm run type-check 2>/dev/null || true
        }
    else
        echo -e "${BLUE}🌟 Running full frontend lint...${NC}"
        docker-compose exec -T frontend npm run lint:fix 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Some ESLint issues couldn't be auto-fixed${NC}"
        }
        
        echo -e "${BLUE}🔍 Running type check...${NC}"
        docker-compose exec -T frontend npm run type-check 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Type check found issues - they may need manual fixing${NC}"
        }
    fi
}

# If argument provided, lint that specific file/directory
if [ $# -eq 0 ]; then
    # No arguments - lint everything
    lint_target ""
else
    # Lint specific target
    lint_target "$1"
fi

echo -e "${GREEN}✅ Claude Auto-Lint: Formatting complete!${NC}"