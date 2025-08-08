#!/bin/bash

# Script to verify branch protection configuration
# Requires GitHub CLI (gh) and repo access

echo "🔍 Checking branch protection for main branch..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Cannot verify branch protection status."
    exit 1
fi

# Check branch protection status
echo "Fetching branch protection rules..."
protection_data=$(gh api repos/mantonx/volumeviz/branches/main/protection 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Branch protection is enabled for main branch"
    echo ""
    
    # Parse and display protection settings
    echo "🛡️  Protection Rules:"
    
    # Check required status checks
    status_checks=$(echo "$protection_data" | jq -r '.required_status_checks.contexts[]? // empty' 2>/dev/null)
    if [ -n "$status_checks" ]; then
        echo "  ✅ Required Status Checks:"
        echo "$status_checks" | sed 's/^/    • /'
        
        # Verify our CI checks are included
        if echo "$status_checks" | grep -q "Go Build, Test & Lint"; then
            echo "    ✅ Backend CI check required"
        else
            echo "    ❌ Backend CI check NOT required"
        fi
        
        if echo "$status_checks" | grep -q "Node Build, Test & Lint"; then
            echo "    ✅ Frontend CI check required"
        else
            echo "    ❌ Frontend CI check NOT required"
        fi
    else
        echo "  ❌ No required status checks configured"
    fi
    
    # Check other settings
    up_to_date=$(echo "$protection_data" | jq -r '.required_status_checks.strict // false')
    if [ "$up_to_date" = "true" ]; then
        echo "  ✅ Require up-to-date branches before merging"
    else
        echo "  ❌ Up-to-date branches NOT required"
    fi
    
    pr_reviews=$(echo "$protection_data" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
    if [ "$pr_reviews" -gt 0 ]; then
        echo "  ✅ Require $pr_reviews PR approval(s)"
    else
        echo "  ⚠️  No PR approvals required"
    fi
    
    force_push=$(echo "$protection_data" | jq -r '.allow_force_pushes.enabled // true')
    if [ "$force_push" = "false" ]; then
        echo "  ✅ Force pushes blocked"
    else
        echo "  ❌ Force pushes allowed"
    fi
    
else
    echo "❌ Branch protection is NOT enabled for main branch"
    echo ""
    echo "Please configure branch protection by:"
    echo "1. Running ./setup-branch-protection.sh (if you have admin access)"
    echo "2. Or manually via GitHub web interface:"
    echo "   https://github.com/mantonx/volumeviz/settings/branches"
fi