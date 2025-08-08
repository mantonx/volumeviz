#!/bin/bash

# Script to set up branch protection for main branch
# Requires GitHub CLI (gh) and repo admin permissions

echo "🛡️  Setting up branch protection for main branch..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it or configure manually via GitHub web interface."
    exit 1
fi

# Create branch protection rule
gh api repos/mantonx/volumeviz/branches/main/protection \
  --method PUT \
  --field required_status_checks='{
    "strict": true,
    "contexts": [
      "Go Build, Test & Lint",
      "Node Build, Test & Lint"
    ]
  }' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  }' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

if [ $? -eq 0 ]; then
    echo "✅ Branch protection successfully configured!"
    echo ""
    echo "Protection rules applied:"
    echo "  - Require PR reviews (1 approval)"
    echo "  - Require CI status checks:"
    echo "    • Backend CI (Go Build, Test & Lint)"
    echo "    • Frontend CI (Node Build, Test & Lint)"
    echo "  - Require up-to-date branches"
    echo "  - Block force pushes"
    echo "  - Block deletions"
    echo ""
    echo "🔒 Main branch is now protected!"
else
    echo "❌ Failed to set up branch protection. Please check permissions or configure manually."
fi