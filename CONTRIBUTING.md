# Contributing to VolumeViz

Thank you for your interest in contributing to VolumeViz! We welcome contributions from developers of all skill levels and backgrounds. This guide will help you get started with contributing to our project.

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Report bugs through [GitHub Issues](https://github.com/mantonx/volumeviz/issues)
- Use the bug report template
- Include detailed reproduction steps
- Provide environment information

### ✨ Feature Requests
- Propose new features via [GitHub Discussions](https://github.com/mantonx/volumeviz/discussions)
- Describe the use case and expected behavior
- Consider implementation complexity
- Check for existing similar requests

### 💻 Code Contributions
- Bug fixes and improvements
- New features and enhancements
- Performance optimizations
- Documentation improvements

### 📚 Documentation
- API documentation improvements
- Tutorial and guide creation
- Code comments and inline documentation
- Translation contributions

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Go 1.21+** for backend development
- **Node.js 18+** and **npm/yarn** for frontend development
- **Docker & Docker Compose** for local development
- **PostgreSQL 15+** (optional, can use Docker)
- **Git** for version control

### Development Environment Setup

#### 1. Fork and Clone
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/volumeviz.git
cd volumeviz

# Add upstream remote
git remote add upstream https://github.com/mantonx/volumeviz.git
```

#### 2. Install Dependencies
```bash
# Install Go dependencies
go mod download

# Install frontend dependencies
cd frontend && npm install
cd ..

# Install development tools
make install-dev-tools
```

#### 3. Start Development Environment
```bash
# Option 1: Full development setup with PostgreSQL
make dev-start

# Option 2: Quick SQLite setup
make dev-sqlite

# Verify setup
make test
```

#### 4. Verify Installation
```bash
# Backend health check
curl http://localhost:8080/health

# Frontend development server
open http://localhost:3000
```

## 🏗️ Development Workflow

### Branch Strategy

We use a **Git Flow** inspired branching strategy:

- `main`: Stable production code
- `develop`: Integration branch for development
- `feature/*`: Feature development branches
- `bugfix/*`: Bug fix branches
- `hotfix/*`: Critical production fixes

### Creating a Feature Branch

```bash
# Update your local repository
git checkout main
git pull upstream main

# Create and checkout feature branch
git checkout -b feature/your-feature-name

# Make your changes...

# Push feature branch
git push origin feature/your-feature-name
```

### Development Guidelines

#### Backend Development (Go)

**Code Organization**
```
internal/
├── api/           # HTTP handlers and middleware
├── core/          # Business logic and domain models
├── database/      # Database connections and transactions
├── services/      # Service layer implementations
├── store/         # Data access layer (SQLC generated)
└── utils/         # Shared utilities
```

**Code Standards**
- Follow standard Go conventions (`gofmt`, `go vet`)
- Use meaningful variable and function names
- Write comprehensive tests for new functionality
- Add comments for public interfaces and complex logic
- Handle errors explicitly and appropriately

**Database Changes**
```bash
# Create new migration
migrate create -ext sql -dir migrations -seq description_of_change

# Edit migration files
# migrations/NNNNNN_description_of_change.up.sql
# migrations/NNNNNN_description_of_change.down.sql

# Test migration
make migrate-up
make migrate-down
make migrate-up
```

**SQLC Queries**
```sql
-- Add queries to internal/repo/queries/*.sql
-- name: GetExampleData :many
SELECT id, name, created_at
FROM examples
WHERE user_id = $1
ORDER BY created_at DESC;
```

```bash
# Generate Go code from SQL
make generate-sqlc
```

#### Frontend Development (React/TypeScript)

**Code Organization**
```
frontend/src/
├── components/    # Reusable UI components
├── pages/         # Page-level components
├── hooks/         # Custom React hooks
├── services/      # API clients and external services
├── utils/         # Helper functions and utilities
└── types/         # TypeScript type definitions
```

**Code Standards**
- Use TypeScript for all new code
- Follow React functional component patterns
- Use custom hooks for stateful logic
- Implement proper error boundaries
- Write accessible components (ARIA attributes)
- Use meaningful component and prop names

**API Integration**
```typescript
// Use generated API client
import { DefaultApi, Configuration } from '../services/api';

const apiConfig = new Configuration({
  basePath: process.env.REACT_APP_API_URL
});

const api = new DefaultApi(apiConfig);
```

### Code Quality Standards

#### Testing Requirements

**Backend Testing**
```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run specific test package
go test ./internal/services/...
```

**Test Structure**
```go
func TestExampleFunction(t *testing.T) {
    // Arrange
    input := "test input"
    expected := "expected output"

    // Act
    result := ExampleFunction(input)

    // Assert
    if result != expected {
        t.Errorf("Expected %s, got %s", expected, result)
    }
}
```

**Frontend Testing**
```bash
# Run frontend tests
cd frontend && npm test

# Run with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
```

#### Linting and Formatting

**Backend**
```bash
# Format code
make fmt

# Run linter
make lint

# Fix linting issues
make lint-fix
```

**Frontend**
```bash
cd frontend

# Format code
npm run format

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Performance Guidelines

#### Database Performance
- Use indexed columns in WHERE clauses
- Implement pagination for large result sets
- Use EXPLAIN ANALYZE to optimize queries
- Consider connection pooling settings

#### API Performance
- Implement request/response compression
- Use appropriate HTTP status codes
- Cache frequently accessed data
- Rate limit expensive operations

#### Frontend Performance
- Lazy load components and routes
- Optimize bundle size with tree shaking
- Use React.memo for expensive components
- Implement virtual scrolling for large lists

## 🔍 Pull Request Process

### Before Submitting

1. **Ensure code quality**
   ```bash
   # Run full test suite
   make test
   make test-frontend

   # Check code formatting
   make lint
   make lint-frontend

   # Build successfully
   make build
   ```

2. **Update documentation**
   - Add/update API documentation for new endpoints
   - Update README if adding major features
   - Add inline code documentation

3. **Test thoroughly**
   - Test happy path scenarios
   - Test error conditions
   - Test edge cases
   - Verify backward compatibility

### Pull Request Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No new linting errors
```

### Review Process

1. **Automated Checks**: CI pipeline runs tests and linting
2. **Code Review**: Maintainer review for code quality and design
3. **Testing**: Feature testing in development environment
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge into target branch

## 📋 Development Guidelines

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code refactoring
- `test`: Adding or fixing tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(api): add volume analytics endpoint

fix(frontend): resolve memory leak in chart component

docs: update API documentation for v1.2

test: add integration tests for volume scanner
```

### Code Review Guidelines

#### As a Reviewer
- **Be constructive**: Provide specific, actionable feedback
- **Be timely**: Review within 2-3 business days
- **Check thoroughly**: Verify functionality, performance, and security
- **Suggest improvements**: Offer alternative approaches when beneficial

#### As a Contributor
- **Respond promptly**: Address review comments within 1-2 business days
- **Ask questions**: Clarify unclear feedback
- **Be open**: Accept constructive criticism positively
- **Test changes**: Verify fixes before requesting re-review

### Security Considerations

- Never commit secrets, API keys, or passwords
- Validate all user inputs
- Use parameterized queries for database operations
- Follow OWASP security guidelines
- Report security vulnerabilities privately (see SECURITY.md)

## 🎉 Recognition

### Contributors

We recognize contributors through:
- **Contributor List**: README.md acknowledgment
- **Release Notes**: Feature contributor attribution
- **Special Recognition**: Outstanding contribution highlights

### Maintainer Track

Interested in becoming a maintainer?
- Consistent high-quality contributions
- Help with code reviews and issue triage
- Community engagement and support
- Technical expertise in project areas

## 📞 Getting Help

### Community Support
- **GitHub Discussions**: General questions and community help
- **Discord**: Real-time chat with contributors (coming soon)
- **Stack Overflow**: Tag questions with `volumeviz`

### Direct Contact
- **Maintainer Team**: maintainers@volumeviz.dev
- **Technical Questions**: dev@volumeviz.dev
- **Security Issues**: security@volumeviz.dev

### Documentation Resources
- **API Documentation**: `/docs/api`
- **Architecture Guide**: `/docs/adr`
- **Development Setup**: `/docs/development`

---

## � Preventing Large File Commits

### ⚠️ Important: No Large Files in Git

To keep the repository lean and fast, **never commit large binary files**. This includes:

**Build Artifacts to Never Commit:**
- **Go binaries**: `volumeviz`, `main`, `*.test` files
- **Node modules**: Large `.node`, `.wasm` files  
- **Archives**: `*.gz`, `*.tar`, `*.zip`, etc.
- **Database files**: `*.db`, `*.sqlite`
- **Temporary files**: Anything in `tmp/` directory

### Pre-Commit Checks
Always run these commands before committing:

```bash
# Check for files larger than 10MB
find . -type f -size +10M -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./vendor/*"

# Review what you're about to commit
git diff --cached --stat
git status
```

### Good Practices
1. **Always run** `git status` before `git add .`
2. **Review** `git diff --cached` before committing  
3. **Use** `git add <specific-files>` instead of `git add .` when in doubt
4. **Test builds** work after adding gitignore rules

### If You Accidentally Stage Large Files
```bash
# Remove from staging (before commit)
git reset HEAD <large-file>

# Remove from last commit (if not pushed yet)
git reset --soft HEAD~1
git reset HEAD <large-file>
```

### Build Commands
```bash
# Build without committing the binary
make build

# Clean build artifacts  
make clean

# Run tests without committing test binaries
go test ./... -v
```

## �📝 License

By contributing to VolumeViz, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to VolumeViz! 🚀**

*This guide is updated regularly. For the latest information, always refer to the version in the main branch.*
