# Claude AI Development Assistant

This document outlines the role of Claude AI in the development of VolumeViz and provides guidelines for AI-assisted development practices within the project.

## 🐳 Docker Development Environment

VolumeViz uses Docker and Docker Compose for development. **Do not attempt to run services directly with npm or go commands**.

### Development Commands

```bash
# Start all services (backend, frontend, database)
docker-compose -f docker-compose.dev.yml up --build

# Start just the backend and database
docker-compose -f docker-compose.dev.yml up backend postgres

# Start frontend development server
docker-compose -f docker-compose.dev.yml up frontend

# View logs
docker-compose -f docker-compose.dev.yml logs -f [service_name]

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild services after code changes
docker-compose -f docker-compose.dev.yml up --build [service_name]
```

### Service Access

- **Frontend**: http://localhost:3000 (React development server)
- **Backend API**: http://localhost:8080 (Go server)  
- **Database**: localhost:5432 (PostgreSQL)

### Testing Changes

When testing backend changes:
1. Rebuild the backend container: `docker-compose -f docker-compose.dev.yml up --build backend`
2. Access API at http://localhost:8080
3. Frontend should automatically connect to the backend

When testing frontend changes:
1. Changes are hot-reloaded automatically in development mode
2. If needed, rebuild: `docker-compose -f docker-compose.dev.yml up --build frontend`

### Important Notes

- All development should be done through Docker containers
- The backend API provides container names in the `container_names` field for volumes
- Frontend connects to backend at http://localhost:8080 for API calls
- Database migrations are handled automatically by the backend on startup

## 🤖 AI Assistant Integration

### Development Partnership

Claude AI serves as a development partner for VolumeViz, assisting with:

- **Code Generation**: Creating boilerplate code, API endpoints, and database queries
- **Code Review**: Identifying potential issues, suggesting improvements, and ensuring best practices
- **Documentation**: Generating comprehensive documentation, API specs, and developer guides
- **Testing**: Writing unit tests, integration tests, and test scenarios
- **Architecture**: Providing architectural guidance and design pattern recommendations

### AI-Assisted Development Workflow

#### 1. Feature Planning
- **User Story Analysis**: Breaking down requirements into implementable tasks
- **Technical Specification**: Creating detailed implementation plans
- **Architecture Review**: Ensuring new features align with existing system design

#### 2. Implementation
- **Code Generation**: Creating initial implementations based on specifications
- **Pattern Consistency**: Ensuring code follows established project patterns
- **Error Handling**: Implementing comprehensive error handling and edge case management

#### 3. Quality Assurance
- **Code Review**: Automated review for common issues and improvements
- **Test Generation**: Creating comprehensive test suites for new functionality
- **Documentation**: Generating and updating technical documentation

#### 4. Optimization
- **Performance Analysis**: Identifying potential performance bottlenecks
- **Security Review**: Ensuring security best practices are followed
- **Refactoring Suggestions**: Recommending code improvements and optimizations

## 📋 AI Development Standards

### Code Quality Guidelines

#### Automated Code Generation
When using AI for code generation, ensure:

- **Type Safety**: All generated code includes proper type annotations
- **Error Handling**: Comprehensive error handling with appropriate logging
- **Testing**: Generated code includes corresponding unit tests
- **Documentation**: Inline comments and documentation for complex logic
- **Consistency**: Generated code follows project conventions and patterns

#### Review Process
All AI-generated code undergoes:

1. **Automated Testing**: Full test suite validation
2. **Human Review**: Manual code review by project maintainers
3. **Integration Testing**: Verification within the complete system
4. **Performance Validation**: Ensuring acceptable performance characteristics

### Best Practices

#### Prompting Guidelines
When working with Claude AI, use:

- **Clear Context**: Provide complete context about the current system state
- **Specific Requirements**: Detail exact functional and non-functional requirements
- **Constraint Definition**: Specify technical constraints and limitations
- **Example Provision**: Provide examples of desired patterns and styles

#### Code Integration
- **Incremental Integration**: Integrate AI-generated code in small, testable chunks
- **Validation Steps**: Always validate generated code through testing and review
- **Human Oversight**: Maintain human oversight for critical system components
- **Documentation Updates**: Update relevant documentation for AI-generated features

## 🔧 Development Tools and Workflow

### AI-Enhanced Development Process

#### Planning Phase
```bash
# Example workflow for new feature development
1. Define requirements and user stories
2. Generate technical specification with AI assistance
3. Review and refine specification with human expertise
4. Create implementation plan with task breakdown
```

#### Implementation Phase
```bash
# Typical AI-assisted implementation cycle
1. Generate initial code structure and boilerplate
2. Implement core business logic with AI assistance
3. Generate comprehensive test suite
4. Review and refine implementation
5. Integrate with existing codebase
```

#### Quality Assurance Phase
```bash
# Quality assurance workflow
1. Run automated test suites
2. Perform AI-assisted code review
3. Execute manual testing procedures
4. Validate performance and security
5. Update documentation and examples
```

### Code Generation Templates

#### API Endpoint Template
```go
// AI-generated API endpoint with full error handling
func (h *Handler) CreateVolume(w http.ResponseWriter, r *http.Request) {
    // Input validation
    // Business logic implementation
    // Error handling and logging
    // Response formatting
    // Audit logging
}
```

#### Database Query Template
```sql
-- AI-generated SQLC query with optimization
-- name: GetVolumeAnalytics :many
SELECT
    v.id,
    v.name,
    vs.total_size,
    vs.file_count
FROM volumes v
INNER JOIN volume_sizes vs ON v.id = vs.volume_id
WHERE v.is_active = $1
ORDER BY vs.total_size DESC
LIMIT $2 OFFSET $3;
```

#### Test Template
```go
// AI-generated comprehensive test
func TestCreateVolume(t *testing.T) {
    // Setup test environment
    // Define test cases (happy path, error cases, edge cases)
    // Execute tests with proper assertions
    // Cleanup test environment
}
```

## 📊 AI Development Metrics

### Quality Metrics

We track the following metrics for AI-assisted development:

- **Code Coverage**: Percentage of AI-generated code covered by tests
- **Bug Rate**: Number of bugs found in AI-generated vs human-written code
- **Performance Impact**: Performance characteristics of AI-generated code
- **Maintenance Overhead**: Time required to maintain AI-generated code

### Productivity Metrics

- **Development Speed**: Time savings from AI assistance
- **Code Quality**: Code quality metrics for AI-assisted development
- **Documentation Completeness**: Coverage and quality of AI-generated documentation
- **Test Coverage**: Completeness of AI-generated test suites

## 🔍 AI Code Review Process

### Automated Review Checklist

AI-assisted code review checks for:

#### Functionality
- [ ] Code meets specified requirements
- [ ] Error handling is comprehensive
- [ ] Edge cases are properly addressed
- [ ] Performance is acceptable

#### Quality
- [ ] Code follows project conventions
- [ ] Type safety is maintained
- [ ] Security best practices are followed
- [ ] Code is maintainable and readable

#### Testing
- [ ] Unit tests cover all code paths
- [ ] Integration tests verify functionality
- [ ] Edge cases are tested
- [ ] Error conditions are tested

#### Documentation
- [ ] Code is properly commented
- [ ] API documentation is updated
- [ ] Examples are provided where needed
- [ ] Architecture decisions are documented

### Human Review Requirements

Despite AI assistance, human review is mandatory for:

- **Security-Critical Code**: Authentication, authorization, data validation
- **Performance-Critical Code**: Database queries, data processing algorithms
- **Architecture Changes**: Modifications to core system architecture
- **Public APIs**: External-facing interfaces and contracts

## 🚀 Future AI Integration

### Planned Enhancements

#### Advanced Code Analysis
- **Performance Optimization**: AI-driven performance analysis and optimization suggestions
- **Security Scanning**: Automated security vulnerability detection and remediation
- **Code Refactoring**: Intelligent refactoring suggestions based on usage patterns

#### Enhanced Development Workflow
- **Automated Testing**: AI-generated test scenarios based on code analysis
- **Documentation Generation**: Automatic documentation updates from code changes
- **Bug Prediction**: Predictive analysis for potential bug locations

#### Deployment and Operations
- **Configuration Optimization**: AI-assisted configuration tuning
- **Monitoring Setup**: Automated monitoring and alerting configuration
- **Performance Tuning**: AI-driven performance optimization recommendations

## 📚 Learning and Adaptation

### Continuous Improvement

The AI development process continuously improves through:

- **Feedback Loops**: Learning from code review feedback and bug reports
- **Pattern Recognition**: Identifying successful patterns for reuse
- **Metric Analysis**: Using development metrics to refine AI assistance
- **Community Input**: Incorporating feedback from the development community

### Knowledge Base

We maintain a knowledge base of:

- **Successful Patterns**: Proven code patterns and architectures
- **Common Issues**: Frequently encountered problems and solutions
- **Best Practices**: Refined development practices based on experience
- **Performance Benchmarks**: Performance characteristics of different approaches

## 🔒 Responsible AI Development

### Ethical Guidelines

Our AI development practices follow these principles:

- **Transparency**: Clear documentation of AI involvement in code generation
- **Accountability**: Human responsibility for all production code
- **Quality Assurance**: Rigorous testing and review of AI-generated code
- **Continuous Learning**: Ongoing improvement of AI assistance quality

### Risk Management

We mitigate AI development risks through:

- **Human Oversight**: Mandatory human review of critical components
- **Testing Requirements**: Comprehensive testing of all AI-generated code
- **Rollback Procedures**: Ability to quickly revert AI-generated changes
- **Monitoring Systems**: Continuous monitoring of system performance and reliability

---

## 📞 AI Development Support

### Getting Help
- **Technical Questions**: Include context about AI involvement in questions
- **Code Review**: Request specific review of AI-generated components
- **Best Practices**: Ask for guidance on effective AI-assisted development

### Contributing AI Improvements
- Share successful AI development patterns
- Report issues or limitations in AI assistance
- Suggest improvements to AI development workflows

---

**This document reflects our current approach to AI-assisted development and will evolve as we learn and improve our practices.**

*Last Updated: August 14, 2025*
