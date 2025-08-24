#!/bin/bash
# Pre-commit hook to prevent large files from being committed
# Copy this to .git/hooks/pre-commit and make it executable

# Maximum file size in bytes (10MB)
MAX_SIZE=10485760

# Check for large files in the commit
large_files=$(git diff --cached --name-only | xargs -I {} find {} -size +10M 2>/dev/null | head -5)

if [ -n "$large_files" ]; then
    echo "🚫 ERROR: Large files detected in commit:"
    echo "$large_files"
    echo ""
    echo "Files larger than 10MB should not be committed to git."
    echo "Please add them to .gitignore or use Git LFS for large assets."
    echo ""
    echo "To bypass this check, use: git commit --no-verify"
    exit 1
fi

# Check for common build artifacts
build_artifacts=$(git diff --cached --name-only | grep -E "(^main$|^volumeviz$|^.*\.test$|^tmp/.*)" | head -5)

if [ -n "$build_artifacts" ]; then
    echo "⚠️  WARNING: Build artifacts detected in commit:"
    echo "$build_artifacts"
    echo ""
    echo "These files are typically build artifacts and shouldn't be committed."
    echo "Consider adding them to .gitignore"
    echo ""
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
