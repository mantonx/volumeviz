# Branch Protection Configuration

This document outlines the branch protection rules for the VolumeViz repository to ensure code quality and security.

## Current Protection Rules

The `main` branch should be protected with the following rules:

### Required Status Checks
- **Backend CI**: `Go Build, Test & Lint`
  - Go build verification
  - Unit tests with race detection
  - golangci-lint static analysis
  - 60% minimum coverage enforcement

- **Frontend CI**: `Node Build, Test & Lint` 
  - Node.js dependency installation
  - Production build verification
  - (TypeScript/ESLint temporarily skipped until API client regeneration)

### Pull Request Requirements
- **Require pull request reviews**: 1 approval minimum
- **Dismiss stale reviews**: When new commits are pushed
- **Require up-to-date branches**: Branches must be current with main before merging

### Push Restrictions
- **Block force pushes**: Prevent history rewriting
- **Block deletions**: Prevent accidental branch deletion
- **No bypassing rules**: Even administrators must follow the rules

## Setup Instructions

### Option 1: GitHub Web Interface
1. Navigate to: `https://github.com/mantonx/volumeviz/settings/branches`
2. Click "Add rule" or edit the existing `main` branch rule
3. Configure the following settings:

```
Branch name pattern: main

☑️ Require a pull request before merging
  ☑️ Require approvals: 1
  ☑️ Dismiss stale pull request approvals when new commits are pushed

☑️ Require status checks to pass before merging
  ☑️ Require branches to be up to date before merging
  
  Required status checks:
  ☑️ Go Build, Test & Lint
  ☑️ Node Build, Test & Lint

☑️ Require conversation resolution before merging  
☑️ Block force pushes
☑️ Do not allow bypassing the above settings
```

### Option 2: GitHub CLI (Automated)
Run the provided setup script (requires admin permissions):
```bash
./setup-branch-protection.sh
```

### Option 3: GitHub API
Use the GitHub REST API with appropriate permissions:
```bash
curl -X PUT \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/mantonx/volumeviz/branches/main/protection \
  -d @branch-protection-config.json
```

## Verification

To verify branch protection is properly configured:
```bash
./check-branch-protection.sh
```

Or check manually at: `https://github.com/mantonx/volumeviz/settings/branches`

## Impact on Development Workflow

With branch protection enabled:

1. **Direct pushes to main are blocked** - All changes must go through pull requests
2. **CI must pass** - Both backend and frontend CI workflows must succeed
3. **Code review required** - At least 1 approval needed before merging
4. **Up-to-date branches** - PRs must be rebased/merged with latest main
5. **Coverage enforcement** - Backend coverage must stay ≥60%

## Troubleshooting

### Common Issues

**Q: PR can't be merged due to required status checks**
A: Ensure both "Go Build, Test & Lint" and "Node Build, Test & Lint" checks are passing

**Q: "Branch is out of date" error**
A: Rebase or merge the latest `main` branch into your feature branch

**Q: Coverage check failing**
A: Add tests to bring coverage above 60% threshold

**Q: Can't push directly to main**
A: Create a feature branch and open a pull request instead

### Status Check Names
The exact status check names that must be configured:
- `Go Build, Test & Lint` (from backend CI workflow)
- `Node Build, Test & Lint` (from frontend CI workflow)

## Security Benefits

Branch protection provides several security and quality benefits:

- **Prevents accidental direct commits** to main branch
- **Ensures code review** for all changes
- **Validates CI pipeline** before merging
- **Maintains code coverage** standards
- **Blocks force pushes** that could rewrite history
- **Requires up-to-date branches** preventing integration issues

## Maintenance

The branch protection rules should be reviewed and updated when:
- New CI workflows are added
- Workflow names change
- Coverage requirements change
- Team review requirements change

---

**Note**: Branch protection requires repository admin permissions to configure. If you don't have these permissions, contact the repository maintainers.