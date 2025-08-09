# Dependency Management & Automerge System

## Overview
This repository features a comprehensive dependency management system with automated policy enforcement, ESLint integration, and intelligent automerge capabilities based on version update types and package risk categories.

## How it Works

### 1. Dependency Grouping
- **Go modules**: Minor and patch updates are grouped together
- **npm packages**: Minor and patch updates are grouped together  
- **GitHub Actions**: All action updates are grouped together
- **Docker**: Individual updates (for visibility)

### 2. Automerge Labels
- The `automerge` label is automatically added to safe dependency updates (patch/minor)
- PRs with the `automerge` label will be automatically approved and merged when all checks pass
- Major version updates require manual review and will get a warning comment

### 3. ESLint Policy Enforcement
- Custom ESLint rules validate package.json against dependency policies
- Enforces version range preferences (^, ~, exact) based on package type
- Prevents major version updates for critical packages
- Validates dependency categorization and risk assessment

### 4. Weekly Review
- Every Monday at 10:00 UTC, a workflow generates a dependency review digest
- Creates/updates an issue summarizing pending PRs and security status
- Provides maintenance suggestions and policy compliance reports

## Manual Operations

### Enable Automerge on a PR
```bash
gh pr edit <PR_NUMBER> --add-label "automerge"
```

### Disable Automerge on a PR  
```bash
gh pr edit <PR_NUMBER> --remove-label "automerge"
```

### Trigger Manual Dependency Review
```bash
gh workflow run dependency-review.yml
```

### Lint Dependency Policies
```bash
# Check dependency policy compliance
cd frontend && npm run lint:deps

# Auto-fix dependency policy issues  
cd frontend && npm run lint:deps:fix
```

### Bulk Label Safe PRs
```bash
# Label all pending patch/minor Dependabot PRs
gh pr list --author "dependabot[bot]" --json number | jq -r '.[].number' | xargs -I {} gh pr edit {} --add-label "automerge"
```

## Safety Features

1. **CI Requirements**: Automerge only happens when all status checks pass
2. **Patch/Minor Only**: Only patch and minor version updates get automatic labeling
3. **Major Version Warnings**: Major updates get warning comments and require manual review
4. **Security Monitoring**: Weekly reviews include security audit summaries
5. **Reviewers**: All PRs still get assigned to maintainers for visibility

## Monitoring

- Check the weekly dependency review issues (labeled `dependencies`, `weekly-review`)
- Monitor the automerge workflow runs for any issues
- Review major version update PRs manually

## Troubleshooting

### Automerge Not Working
1. Check if all CI checks are passing
2. Verify the `automerge` label is present
3. Check workflow run logs for errors

### Too Many PRs
1. Review the weekly digest
2. Consider batch merging safe updates
3. Adjust open-pull-requests-limit in dependabot.yml

### Security Issues  
1. Review weekly security audit
2. Prioritize security updates over feature updates
3. Consider pinning vulnerable packages temporarily