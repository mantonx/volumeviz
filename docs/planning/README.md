# VolumeViz Planning Documentation

This directory contains comprehensive analysis and planning documents for the VolumeViz project.

## Documents

### [01-codebase-audit.md](./01-codebase-audit.md)
Comprehensive audit of the codebase identifying 89 issues across backend and infrastructure:
- 15 Critical priority issues
- 28 High priority issues
- 32 Medium priority issues
- 14 Low priority issues

Key findings: Database views exist but SQLC queries never generated, Stats repository returns placeholder data, Retention system completely stubbed.

### [02-missing-features.md](./02-missing-features.md)
Analysis of missing features for a complete Docker volume analytics platform:
- Storage insights & optimization
- Advanced search & discovery
- Visualization & reporting
- Docker ecosystem integration (read-only monitoring)

**Important**: VolumeViz is a READ-ONLY analytics tool, not a volume management platform. Does not include backup/restore/lifecycle management features.

### [03-admin-config-system.md](./03-admin-config-system.md)
Complete design for admin panel and configuration system:
- 3-tier configuration architecture
- System settings management
- Organization-level settings
- User preferences
- Admin UI components

**Gap Identified**: Currently NO admin panel exists. Frontend has only client-side settings, backend has env-var only config.

### [04-implementation-roadmap.md](./04-implementation-roadmap.md)
Master implementation plan consolidating all audits and analyses:
- **Context**: Open source project, solo developer timeline
- **Timeline**: 6-8 months to v1.0 (10-20 hours/week)
- **Phases**: Critical fixes → Missing features → Admin system → Polish
- **Budget**: ~$100/year (hosting/domain only)
- Open source strategy and community contribution opportunities

### [06-immediate-cleanup-plan.md](./06-immediate-cleanup-plan.md)
Short-term cleanup plan to eliminate half-finished features:
- **Timeline**: 5 days (~12 hours total)
- **Status**: ✅ COMPLETED (October 4, 2025)
- Fixed SearchPage, ExplorerPage, stats repository, retention system
- Removed non-functional UI elements (duplicate detection)
- Result: Honest product where all features actually work

### [07-scanner-resilience-improvements.md](./07-scanner-resilience-improvements.md)
Comprehensive plan to transform scanner to production-grade resilient system:
- **Timeline**: 3 weeks (40-60 hours)
- **Priority**: High - Required for production deployments
- **Status**: Planned
- Adds retry logic, timeout handling, crash recovery, panic handling
- Includes checkpoint/resume, circuit breaker, transaction safety
- Target: 6.5/10 → 9/10 resilience rating

## Reading Order

For new contributors or to understand project status:

1. Start with **04-implementation-roadmap.md** for overall context and OSS strategy
2. Review **01-codebase-audit.md** to understand current technical debt
3. Check **02-missing-features.md** for feature gaps and product scope
4. Review **03-admin-config-system.md** if working on admin/config features

## Project Scope

VolumeViz is a **Docker volume analytics and monitoring platform** (read-only):
- Storage usage visualization and insights
- File system exploration and duplicate detection
- Team collaboration features
- Cross-volume analytics

It is **NOT** a volume lifecycle management tool (no backup/restore/snapshots).

Think: **WinDirStat + Docker integration + Team features**

## Tech Stack

- **Backend**: Go, PostgreSQL, SQLC
- **Frontend**: React, TypeScript, TanStack Query, Jotai
- **Architecture**: Multi-tenant with organization isolation, RLS

---

*Last Updated: October 1, 2025*
