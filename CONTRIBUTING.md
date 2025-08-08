# Contributing to VolumeViz

Thank you for your interest in contributing to VolumeViz! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/volumeviz.git
   cd volumeviz
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/mantonx/volumeviz.git
   ```
4. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### Prerequisites

- Go 1.21+
- Node.js 18+ and npm 9+
- Docker 20.10+ and Docker Compose 2.0+
- PostgreSQL 15+ (or use Docker)

### Setting Up Development Environment

1. **Backend Setup**:
   ```bash
   go mod download
   make run-backend
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup**:
   ```bash
   docker compose up -d postgres
   make migrate
   ```

### Code Style

#### Go Code Style
- Follow standard Go formatting (use `gofmt`)
- Use meaningful variable and function names
- Add comments for exported functions and types
- Keep functions small and focused
- Run `make lint` before committing

#### JavaScript/React Code Style
- Use ESLint and Prettier configurations provided
- Follow React best practices and hooks guidelines
- Use functional components with hooks
- Keep components small and reusable
- Run `npm run lint` and `npm run format` before committing

### Testing

#### Writing Tests
- Write unit tests for new functionality
- Maintain or improve code coverage
- Use table-driven tests in Go where appropriate
- Use React Testing Library for frontend tests

#### Running Tests
```bash
# Backend tests
make test

# Frontend tests
cd frontend && npm test

# Integration tests
make test-integration

# All tests
make test-all
```

#### Coverage Gate (CI)
- Backend CI enforces a minimum total Go test coverage of 60%.
- PRs that drop total coverage below 60% will fail with a clear message showing the measured percentage.
- You can generate coverage locally with:
  ```bash
  go test -race -covermode=atomic -coverprofile=coverage.out -v ./...
  go tool cover -func=coverage.out | tail -n1
  ```

### Commit Guidelines

We follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

Example:
```
feat(api): add container filtering endpoint

Add new endpoint /api/v1/containers/filter that allows
filtering containers by status, name, and labels.

Closes #123
```

## Submitting Changes

### Pull Request Process

1. Update your branch with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Run all tests and ensure they pass:
   ```bash
   make test-all
   ```

3. Update documentation if needed

4. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Create a Pull Request on GitHub

### Pull Request Guidelines

- Give your PR a descriptive title
- Reference any related issues
- Describe what changes you've made
- Include screenshots for UI changes
- Ensure all CI checks pass
- Request review from maintainers

### Code Review Process

- All submissions require review before merging
- Reviewers will provide feedback on code quality, design, and implementation
- Address review comments and push updates
- Once approved, a maintainer will merge your PR

## Architecture Decisions

### Backend Architecture
- Use clean architecture principles
- Separate concerns: handlers, services, repositories
- Use dependency injection
- Follow SOLID principles

### Frontend Architecture
- Component-based architecture
- Separate presentational and container components
- Use custom hooks for reusable logic
- Centralize API calls in service modules

## Documentation

### Code Documentation
- Document all exported functions and types
- Include examples in documentation where helpful
- Keep documentation up-to-date with code changes

### API Documentation
- Update OpenAPI/Swagger documentation for API changes
- Include request/response examples
- Document error responses

## Release Process

1. Version numbers follow Semantic Versioning (SemVer)
2. Releases are created from the main branch
3. Each release includes:
   - Compiled binaries for major platforms
   - Docker images
   - Release notes with changes

## Getting Help

- Create an issue for bugs or feature requests
- Join our Discord server for discussions
- Check existing issues before creating new ones
- Use issue templates when available

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Our website (when applicable)

Thank you for contributing to VolumeViz!