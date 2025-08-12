#!/bin/bash

# E2E Test Runner Script
# Starts backend and frontend servers, then runs Cypress E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[E2E]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[E2E]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[E2E]${NC} $1"
}

print_error() {
    echo -e "${RED}[E2E]${NC} $1"
}

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
DATABASE_URL=${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/volumeviz_dev?sslmode=disable}
MODE=${1:-run} # run, open, or headless

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    
    if [ -n "$BACKEND_PID" ]; then
        print_status "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        print_status "Stopping frontend server (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "volumeviz" 2>/dev/null || true
    pkill -f "vite.*5173" 2>/dev/null || true
    
    print_success "Cleanup complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go 1.21 or later."
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or later."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check if PostgreSQL is running (optional)
    if ! pg_isready -q 2>/dev/null; then
        print_warning "PostgreSQL doesn't seem to be running. Make sure it's available at $DATABASE_URL"
    fi
    
    print_success "Prerequisites check complete"
}

# Build backend
build_backend() {
    print_status "Building backend..."
    
    cd "$(dirname "$0")/.." # Go to project root
    
    if ! go mod tidy; then
        print_error "Failed to tidy Go modules"
        exit 1
    fi
    
    if ! go build -o volumeviz cmd/server/main.go; then
        print_error "Failed to build backend"
        exit 1
    fi
    
    print_success "Backend built successfully"
}

# Install frontend dependencies and build
build_frontend() {
    print_status "Installing frontend dependencies..."
    
    cd frontend
    
    if ! npm ci; then
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    
    print_success "Frontend dependencies installed"
}

# Start backend server
start_backend() {
    print_status "Starting backend server on port $BACKEND_PORT..."
    
    cd "$(dirname "$0")/.." # Go to project root
    
    # Set environment variables
    export DATABASE_URL="$DATABASE_URL"
    export PORT="$BACKEND_PORT"
    export ENABLE_WEBSOCKET=true
    export LOG_LEVEL=info
    export GIN_MODE=release
    
    # Start backend server in background
    ./volumeviz > backend.log 2>&1 &
    BACKEND_PID=$!
    
    print_status "Backend server starting with PID: $BACKEND_PID"
    
    # Wait for backend to be ready
    print_status "Waiting for backend server to be ready..."
    timeout 30 bash -c "
        while ! curl -f http://localhost:$BACKEND_PORT/api/v1/health > /dev/null 2>&1; do
            sleep 1
        done
    " || {
        print_error "Backend server failed to start within 30 seconds"
        print_error "Backend logs:"
        cat backend.log || true
        exit 1
    }
    
    print_success "Backend server is ready"
}

# Start frontend dev server
start_frontend() {
    print_status "Starting frontend dev server on port $FRONTEND_PORT..."
    
    cd frontend
    
    # Set environment variables
    export VITE_API_BASE_URL="http://localhost:$BACKEND_PORT"
    export VITE_WS_URL="ws://localhost:$BACKEND_PORT/api/v1/ws"
    export VITE_ENABLE_WEBSOCKET=true
    export VITE_DEV_MODE=true
    
    # Start frontend server in background
    npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    print_status "Frontend server starting with PID: $FRONTEND_PID"
    
    # Wait for frontend to be ready
    print_status "Waiting for frontend server to be ready..."
    timeout 60 bash -c "
        while ! curl -f http://localhost:$FRONTEND_PORT > /dev/null 2>&1; do
            sleep 1
        done
    " || {
        print_error "Frontend server failed to start within 60 seconds"
        print_error "Frontend logs:"
        cat ../frontend.log || true
        exit 1
    }
    
    print_success "Frontend server is ready"
}

# Run Cypress tests
run_cypress() {
    print_status "Running Cypress tests in $MODE mode..."
    
    cd frontend
    
    # Set Cypress environment variables
    export CYPRESS_baseUrl="http://localhost:$FRONTEND_PORT"
    export CYPRESS_API_BASE_URL="http://localhost:$BACKEND_PORT"
    export CYPRESS_WS_URL="ws://localhost:$BACKEND_PORT/api/v1/ws"
    export CYPRESS_ENABLE_WEBSOCKET=true
    export CYPRESS_COMMAND_TIMEOUT=10000
    export CYPRESS_RESPONSE_TIMEOUT=10000
    
    case "$MODE" in
        "open")
            print_status "Opening Cypress Test Runner..."
            npm run cypress:open
            ;;
        "headless")
            print_status "Running Cypress tests in headless mode..."
            npm run cypress:run:headless
            ;;
        *)
            print_status "Running Cypress tests..."
            npm run cypress:run
            ;;
    esac
    
    CYPRESS_EXIT_CODE=$?
    
    if [ $CYPRESS_EXIT_CODE -eq 0 ]; then
        print_success "All Cypress tests passed!"
    else
        print_error "Some Cypress tests failed (exit code: $CYPRESS_EXIT_CODE)"
        
        # Show test artifacts location
        if [ -d "cypress/screenshots" ] && [ "$(ls -A cypress/screenshots 2>/dev/null)" ]; then
            print_status "Screenshots available in: frontend/cypress/screenshots"
        fi
        
        if [ -d "cypress/videos" ] && [ "$(ls -A cypress/videos 2>/dev/null)" ]; then
            print_status "Videos available in: frontend/cypress/videos"
        fi
        
        exit $CYPRESS_EXIT_CODE
    fi
}

# Print usage information
print_usage() {
    echo "Usage: $0 [run|open|headless]"
    echo ""
    echo "Options:"
    echo "  run      Run Cypress tests in headed mode (default)"
    echo "  open     Open Cypress Test Runner GUI"
    echo "  headless Run Cypress tests in headless mode"
    echo ""
    echo "Environment Variables:"
    echo "  BACKEND_PORT   Backend server port (default: 8080)"
    echo "  FRONTEND_PORT  Frontend dev server port (default: 5173)"
    echo "  DATABASE_URL   PostgreSQL connection string"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run tests in headed mode"
    echo "  $0 open               # Open Cypress GUI"
    echo "  $0 headless           # Run tests headlessly"
    echo "  BACKEND_PORT=9000 $0  # Use custom backend port"
}

# Main execution
main() {
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        print_usage
        exit 0
    fi
    
    print_status "Starting VolumeViz E2E test suite..."
    print_status "Backend port: $BACKEND_PORT"
    print_status "Frontend port: $FRONTEND_PORT"
    print_status "Test mode: $MODE"
    
    check_prerequisites
    build_backend
    build_frontend
    start_backend
    start_frontend
    
    # Give servers a moment to fully initialize
    sleep 2
    
    run_cypress
}

# Run main function
main "$@"