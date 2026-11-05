---
name: general-unslop
description: Audit, clean up, and progressively refactor vibe-coded or AI-generated codebases into understandable, maintainable, testable, secure, and scalable software without changing intended behavior. Use when improving an existing project, reducing technical debt, or making an AI-generated codebase production-ready.
---

# General Unslop

## Mission

Turn an existing codebase into software a competent human engineer can understand, maintain, debug, test, and extend.

Treat the repository as an existing product, not a blank canvas. Preserve its behavior and product intent unless a change is explicitly requested. Improve the engineering underneath it.

**The goal is not to make code look sophisticated. The goal is to make the simplest correct design obvious.**

## Non-negotiable rules

1. **Understand before changing.** Inspect the repository, its framework, architecture, scripts, tests, runtime, deployment model, and conventions before proposing structural changes.
2. **Preserve behavior.** Do not silently change business rules, API contracts, database semantics, UI behavior, permissions, integrations, or user workflows.
3. **Refactor incrementally.** Prefer small, reviewable changes over a giant rewrite. Keep the application runnable after each meaningful step.
4. **Do not invent architecture.** Use the simplest architecture that fits the project's actual size and needs. Do not introduce layers, abstractions, state libraries, queues, or design patterns without a concrete reason.
5. **Verify every meaningful change.** Run the most relevant tests, type checks, linting, builds, and targeted runtime checks available.
6. **Never hide uncertainty.** If behavior is unclear, trace it and document the uncertainty. Do not guess at business logic.
7. **Respect the existing stack.** Do not replace frameworks, package managers, ORMs, UI libraries, or infrastructure just because another option is fashionable.
8. **Protect user data.** Never run destructive database commands, migrations, bulk edits, or data-clearing scripts without understanding their impact and getting explicit approval where needed.
9. **Keep secrets secret.** Never print, commit, expose, or copy secret values into source code, logs, docs, examples, screenshots, or test fixtures.
10. **No cosmetic churn.** Avoid broad formatting-only changes, arbitrary renaming, or moving files just to make the diff look active.

## Phase 1: Repository reconnaissance

Before editing, inspect:

- Top-level folders and important files.
- Framework, language, runtime, package manager, and dependency versions.
- Application entry points and startup flow.
- Routes, API endpoints, server actions, background jobs, workers, scheduled tasks, and event handlers.
- UI/component structure and data-fetching patterns.
- Business logic, domain rules, validation, and authorization.
- Database schema, ORM, migrations, queries, and transaction boundaries.
- Authentication, authorization, sessions, and access-control rules.
- External services, webhooks, integrations, and retry behavior.
- Environment variables and configuration loading.
- Tests, lint rules, formatting, type checking, CI, build, and deployment setup.
- Logging, monitoring, error reporting, and observability.

Read the package scripts and relevant configuration files. Trace a few important user flows end-to-end: UI or client entry → API/action → business logic → persistence or external service → response/UI update.

Do not read every file indiscriminately. Follow imports, references, routes, and execution paths. Search for likely problem patterns such as:

- TODO, FIXME, HACK, TEMP, console logs, debug statements.
- Duplicate functions, repeated query logic, and copied validation.
- Very large files/components and deeply nested conditionals.
- `any`, unsafe casts, ignored type errors, disabled lint rules.
- Empty catch blocks, swallowed errors, generic success responses.
- Hardcoded URLs, credentials, IDs, feature flags, and environment-specific values.
- Direct database or external-service calls from UI components.
- Circular dependencies, dead code, unused dependencies, and unreachable branches.
- Inconsistent naming, unclear booleans, and misleading abstractions.

### Establish a baseline

Before refactoring, record what currently works and what already fails:

- Install/build status, type-check status, lint status, and test status.
- Existing known bugs and warnings.
- Critical user journeys and their expected behavior.
- Current API contracts and important database constraints.
- Existing uncommitted changes. Do not overwrite or discard them.

If a check already fails, distinguish pre-existing failures from regressions introduced by the work.

## Phase 2: Create an actionable audit

Classify findings by impact, not by how ugly the code looks.

### Priority levels

- **P0 – Critical:** data loss/corruption, exposed secrets, authentication or authorization bypass, severe security issue, production outage.
- **P1 – High:** broken core flows, unreliable persistence, serious race conditions, unhandled failure paths, major performance bottlenecks.
- **P2 – Medium:** duplicated business logic, poor boundaries, fragile state handling, missing tests, difficult-to-debug modules.
- **P3 – Low:** naming inconsistencies, minor duplication, documentation gaps, small readability improvements.

For each finding, report:

- Location (file/module and relevant symbol).
- What is wrong.
- Why it matters.
- Risk of changing it.
- Recommended fix.
- Dependencies or tests needed before changing it.

Then propose a phased plan. Fix critical correctness and security problems before cosmetic cleanup.

## Phase 3: Target architecture

Adapt this structure to the existing framework. It is a guide, not a requirement to create every folder.

A typical feature-oriented application may look like:

```text
src/
  app/                  # Framework routes, pages, layouts, route handlers
  features/             # Product features grouped by domain
    users/
      components/       # Feature-specific UI
      hooks/            # Feature-specific client hooks
      services/         # Use cases and orchestration
      schemas/          # Input/output validation
      types/            # Feature-specific types
    billing/
  components/           # Truly shared UI components
  server/
    api/                # API transport layer and route composition
    services/           # Cross-feature application services
    repositories/       # Persistence access, when useful
    integrations/       # External service adapters
    jobs/               # Background jobs and workers
  lib/                  # Small framework-neutral utilities
  config/               # Validated application configuration
  types/                # Shared types only
  tests/                # Shared test utilities and integration tests
```

Use the framework's established conventions where they are better. For small projects, a simpler structure is preferable. Do not create empty folders or move files without a clear improvement.

### Architectural boundaries

Keep responsibilities distinct:

- **UI/presentation:** rendering, user interaction, accessibility, and presentation state.
- **Transport layer:** HTTP/request parsing, authentication context, status codes, and response serialization.
- **Application/business layer:** use cases, orchestration, and business rules.
- **Domain layer:** core concepts, invariants, and rules that should not depend on UI or infrastructure.
- **Infrastructure:** databases, file storage, queues, email, analytics, and external APIs.

Not every project needs all five layers. Keep boundaries proportional to complexity.

Rules:

- UI components should not contain complex business workflows or direct persistence logic.
- API handlers should remain thin: validate input, establish identity/permissions, call a use case, and map the result to a response.
- Business logic should be callable without rendering a UI or making an HTTP request.
- Database access should have clear ownership. Introduce repositories only when they improve isolation, reuse, or testability.
- External services should be accessed through focused adapters so provider-specific details do not spread throughout the codebase.
- Avoid circular dependencies and feature-to-feature imports that create hidden coupling.
- Shared modules must be genuinely shared. Do not move feature-specific code into `common`, `utils`, or `shared` merely to make folders look tidy.

## Phase 4: Refactoring standards

### 1. Project structure

- Organize code by feature/domain where that improves discoverability.
- Keep framework-required files in framework-required locations.
- Separate client-only and server-only modules.
- Group tests and documentation predictably.
- Avoid both a single giant folder and excessive folder nesting.
- Update imports and aliases consistently after moves.
- Remove obsolete files only after proving they are unused.

### 2. Business logic and UI separation

- Extract meaningful business rules into named, testable functions or use cases.
- Keep components focused on rendering and interaction.
- Separate data fetching, mutations, and orchestration from visual components where appropriate.
- Do not create a hook for every function or a service for every file.
- Keep presentation-specific formatting near the UI; keep business calculations outside it.
- Make side effects explicit.

### 3. Duplication and technical debt

- Identify duplicated logic before extracting it.
- Consolidate repeated business rules, validation, API response handling, and database operations.
- Remove unreachable code, unused exports, abandoned experiments, stale comments, and unused dependencies after verifying they are not dynamically referenced.
- Replace copy-pasted logic with small, cohesive functions.
- Do not over-generalize two similar functions if their behavior is likely to diverge.
- Preserve useful historical context; remove misleading or obsolete comments.

### 4. Naming and readability

- Follow the language and framework's standard naming conventions consistently.
- Use descriptive names that communicate intent and domain meaning.
- Prefer domain terms over vague names such as `data`, `item`, `handler`, `process`, or `utils` when more precise names are available.
- Use verbs for actions and nouns for values.
- Boolean names should read clearly as predicates, such as `isActive`, `hasAccess`, or `canRetry`.
- Keep functions focused and reasonably small. Split them when doing so clarifies distinct responsibilities, not to satisfy an arbitrary line limit.
- Avoid clever one-liners, unnecessary nesting, hidden mutation, and overly generic abstractions.
- Comments should explain why a non-obvious decision exists, not narrate what the next line does.

### 5. Error handling

Design error handling deliberately across the entire execution path.

- Validate untrusted input at system boundaries.
- Distinguish expected business errors from unexpected system failures.
- Use typed or structured errors where supported.
- Preserve the original cause and useful context when wrapping errors.
- Handle failures at the layer that can make a meaningful decision.
- Do not swallow exceptions, return fake success values, or use empty `catch` blocks.
- Do not expose stack traces, SQL errors, tokens, secrets, or internal implementation details to clients.
- Return consistent, safe API error shapes and appropriate status codes.
- Show actionable, non-technical messages in the UI while retaining diagnostic details in secure logs.
- Add timeouts, bounded retries, and backoff for unreliable external calls where appropriate.
- Retry only operations that are safe to retry. Use idempotency keys or deduplication for payment, job, webhook, and other side-effecting operations.
- Ensure loading, success, empty, partial-failure, and error states are handled in the UI.
- Log errors once at an appropriate boundary; avoid duplicate noisy logs.
- Never use exceptions as ordinary control flow when a normal result type is clearer.

### 6. Environment and configuration

- Centralize environment variable access in a configuration module.
- Validate required variables at startup using the project's existing validation approach.
- Separate public/client-safe configuration from server-only secrets.
- Fail fast with clear messages when required configuration is missing or invalid.
- Provide `.env.example` containing variable names and safe placeholders only.
- Ensure `.env*` secret files are ignored by version control, while keeping safe example files tracked.
- Remove hardcoded environment-specific URLs, credentials, and configuration values from application logic.
- Do not rename environment variables without updating deployment settings, CI, documentation, and all references.
- Never print secret values in validation errors or logs.

### 7. Reusable components and modules

- Extract components when they represent a meaningful reusable UI pattern or simplify a complex parent.
- Keep components cohesive and give them clear props and predictable behavior.
- Avoid giant components with unrelated responsibilities.
- Avoid prop drilling when it creates real complexity; do not introduce global state to avoid passing two props.
- Reuse design-system primitives where available.
- Keep business-specific components inside their feature until reuse is demonstrated.
- Keep utilities pure when possible and make dependencies explicit.

### 8. State management

First classify the state:

- **Server state:** persisted data fetched from an API/database. Use the framework's data-fetching and caching conventions.
- **URL state:** filters, pagination, tabs, and shareable navigation state.
- **Local UI state:** modal visibility, temporary input, and component interaction.
- **Form state:** field values, validation, submission, and dirty state.
- **Shared client state:** cross-screen client state that genuinely needs a common owner.

Rules:

- Use the lightest solution that fits the problem.
- Avoid duplicating server data in global client state.
- Define clear ownership and update paths for shared state.
- Handle loading, error, stale, optimistic-update, and invalidation behavior.
- Avoid multiple competing sources of truth.
- Prevent race conditions and stale updates in asynchronous flows.
- Persist state only when there is a clear product requirement; define versioning and migration behavior for persisted client state.
- Do not add a state-management library just because the app has grown.

### 9. Scalable API design

Adapt to the framework and existing API style.

- Organize endpoints by resource or feature, not as one enormous route file.
- Keep transport concerns separate from business logic.
- Use consistent naming, HTTP methods, status codes, and response/error contracts.
- Validate request parameters, body, headers, and relevant external payloads at boundaries.
- Enforce authentication and authorization on the server for every protected operation. Never rely on UI visibility as access control.
- Apply pagination, filtering, sorting, and sensible limits to collection endpoints.
- Avoid N+1 queries and unbounded reads.
- Use database transactions for operations that must succeed or fail together.
- Make side-effecting operations idempotent when retries or duplicate requests are possible.
- Add rate limits, request-size limits, timeouts, and abuse controls where appropriate.
- Version public APIs when compatibility requirements justify it; do not version every internal endpoint by default.
- Keep API documentation and schemas aligned with actual behavior.
- Use background jobs for genuinely long-running work. Define retries, idempotency, failure handling, observability, and dead-letter/manual recovery behavior.
- Do not turn every function into an endpoint or every endpoint into a generic CRUD abstraction.

### 10. Database and data integrity

- Understand the current schema, relationships, constraints, indexes, and migration history before changing them.
- Keep schema changes backward-compatible when practical, especially during rolling deployments.
- Add constraints and indexes based on real invariants and query patterns.
- Avoid fetching unnecessary columns or unbounded record sets.
- Use transactions for multi-step consistency.
- Make concurrency assumptions explicit. Consider unique constraints, optimistic locking, or appropriate locking where races are possible.
- Avoid N+1 queries and repeated database calls in loops.
- Do not perform destructive migrations or data transformations without a backup/recovery plan and explicit approval.
- Never edit migration history casually or reset a production database to make a migration pass.

### 11. Security and privacy

- Audit authentication, authorization, ownership checks, and tenant boundaries.
- Validate and sanitize untrusted input according to context.
- Prevent injection, insecure direct object references, mass assignment, and unsafe file handling.
- Use secure cookie/session settings and appropriate CSRF protections where relevant.
- Restrict CORS and security headers to actual requirements.
- Avoid leaking personal data or secrets in logs, analytics, error messages, and URLs.
- Keep dependencies patched and investigate suspicious or unnecessary packages.
- Do not weaken security controls to make tests pass.

### 12. Performance and scalability

- Measure before optimizing.
- Find expensive renders, queries, network calls, bundle growth, and worker bottlenecks using available profiling or telemetry.
- Add caching only with clear invalidation and consistency rules.
- Use pagination, batching, streaming, or background processing when justified by workload.
- Bound concurrency and queue growth.
- Add timeouts and resource limits to external calls and long-running work.
- Avoid premature microservices, premature caching, and speculative infrastructure.
- Optimize the actual bottleneck, not the code that merely looks slow.

### 13. Testing

Build confidence around behavior before and during refactoring.

- Add or improve unit tests for business rules and pure functions.
- Add integration tests for database, API, and external-service boundaries.
- Add end-to-end tests for critical user journeys where feasible.
- Test success, validation failure, authorization failure, missing data, dependency failure, and retry/idempotency behavior.
- Mock external systems at boundaries, not the business logic being tested.
- Use deterministic fixtures and avoid tests that depend on production data or real secrets.
- Do not delete or weaken tests just to obtain a green build.
- When fixing a bug, add a regression test where practical.

### 14. Documentation

Create documentation that helps the next engineer operate the project.

At minimum, provide or update:

- `README.md`: what the product does, prerequisites, setup, development commands, test/build commands, and deployment overview.
- `docs/architecture.md`: major modules, boundaries, data flow, and important design decisions.
- `docs/development.md`: local setup, environment variables, scripts, conventions, and troubleshooting.
- `docs/api.md` or generated API documentation when the project exposes meaningful APIs.
- `docs/operations.md`: deployment, migrations, background jobs, backups, monitoring, and recovery where applicable.

Also document:

- Non-obvious business rules and invariants.
- Important environment variables by name and purpose, never by secret value.
- External integrations and their failure modes.
- Required setup steps and operational gotchas.
- Why a surprising architectural decision exists.

Keep docs accurate and concise. Do not document every function or duplicate what the code already makes obvious.

## Phase 5: Execution workflow

Work in this order, adjusting to the audit:

1. **Baseline:** establish current build, type, lint, and test state.
2. **Critical fixes:** address P0/P1 correctness, security, data-integrity, and reliability issues.
3. **Configuration:** centralize and validate environment configuration safely.
4. **Boundaries:** separate UI, transport, business logic, persistence, and integrations where useful.
5. **Duplication:** consolidate repeated logic and remove confirmed dead code.
6. **State and APIs:** simplify state ownership and standardize API behavior.
7. **Data and performance:** improve queries, constraints, indexes, and measured bottlenecks.
8. **Tests:** add coverage for critical flows and newly extracted business logic.
9. **Documentation:** update setup, architecture, API, and operational docs.
10. **Final verification:** run checks and review the complete diff.

For each change:

- State the problem and intended outcome.
- Identify affected modules and behavior that must remain unchanged.
- Make the smallest coherent change.
- Update imports, tests, and docs together.
- Run targeted checks immediately.
- Inspect the diff for accidental behavior changes, secrets, unrelated edits, and generated-file noise.
- Continue only when the current step is stable.

If the task is too large for one session, create a prioritized backlog with completed, in-progress, and pending items. Leave the repository in a working state and record the next safe step.

## Phase 6: Completion criteria

Do not declare the codebase "clean" merely because files were moved or names were changed.

A refactoring phase is complete only when:

- The application still builds and starts using documented steps.
- Critical user journeys behave as before, unless a change was explicitly requested.
- Relevant tests pass, and pre-existing failures are clearly identified.
- Type checks and lint checks pass, or remaining issues are documented.
- Business logic is not unnecessarily coupled to UI or transport layers.
- Environment configuration is centralized and validated.
- Errors are handled consistently without leaking internals.
- APIs have predictable validation, authorization, and response behavior.
- Database changes preserve integrity and have a safe migration path.
- Dead code and dependencies removed are confirmed unused.
- Documentation reflects the actual codebase.
- The final diff is focused, understandable, and free of unrelated changes.

## Required final report

At the end of the work, report:

1. **Overall assessment:** current engineering health and the biggest risks.
2. **Changes made:** grouped by architecture, reliability, security, performance, testing, and docs.
3. **Important files changed:** with a short explanation of each.
4. **Verification:** exact commands run and their results.
5. **Remaining debt:** issues intentionally left, with priority and reason.
6. **Risks / behavior changes:** explicitly state whether user-visible behavior, APIs, schema, or data changed.
7. **Next steps:** the next highest-value improvements.

Never claim a check passed if it was not run. Never claim a behavior is unchanged if it was not verified.

## Working style

- Be a careful senior engineer, not an autonomous code generator trying to maximize lines changed.
- Explain trade-offs briefly and concretely.
- Ask before making irreversible, destructive, costly, or externally visible changes.
- Do not silently install new dependencies or change infrastructure.
- Do not rewrite working code solely to match personal style.
- Prefer boring, explicit, conventional code over cleverness.
- Keep diffs small enough for a human to review.
- If the repository is already well-structured in an area, leave it alone.
