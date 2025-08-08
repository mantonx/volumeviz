#!/bin/bash

# Run golangci-lint with our configuration
# Usage: ./scripts/lint.sh [optional golangci-lint args]

set -e

# Check if golangci-lint is installed
if ! command -v golangci-lint &> /dev/null && ! [ -f "$HOME/bin/golangci-lint" ]; then
    echo "golangci-lint not found. Installing..."
    mkdir -p ~/bin
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b ~/bin v1.64.8
    export PATH="$HOME/bin:$PATH"
fi

# Use local installation if available
if [ -f "$HOME/bin/golangci-lint" ]; then
    GOLANGCI_LINT="$HOME/bin/golangci-lint"
else
    GOLANGCI_LINT="golangci-lint"
fi

# Run from project root
cd "$(dirname "$0")/.."

echo "Running golangci-lint..."
$GOLANGCI_LINT run --timeout=5m "$@"