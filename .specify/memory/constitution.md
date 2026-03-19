<!-- 
SYNC IMPACT REPORT – Constitution v1.1.0
=========================================
Version Change: 1.0.0 → 1.1.0
Amended: 2026-03-19
Principles Modified (Architectural Pivot):
  • Section I (Zero-Latency Performance): BroadcastChannel → Pusher WebSockets
  • Section II (Technology Stack Purity): BroadcastChannel API → Pusher JS + Pusher PHP SDK
  • Development Philosophy: Updated for Pusher WebSocket state
  • All other principles preserved unchanged

Rationale:
  Architecture pivot required to support mobile phone control over internet
  (InfinityFree hosting constraint). BroadcastChannel (same-origin only)
  replaced with Pusher (cloud-based, internet-accessible).

Impact Analysis:
  • Task scope unchanged (still 31 tasks, same action types)
  • Frontend logic preserved (only transport layer changes)
  • Backend: +1 new task (2.6: Pusher broadcaster endpoint)
  • 4 tasks refactored (4.1, 4.5, 4.6, 4.8)
  • Timeline: +1–2 days for Pusher integration
  
Dependent Templates Updated:
  ✅ IMPLEMENTATION_ROADMAP.md – Tasks 2.6, 4.1, 4.5, 4.6, 4.8 refactored
  ✅ ARCHITECTURE_PIVOT_SUMMARY.md – New documentation created
-->

# B1G_TIMER Constitution

Real-time stage timer application governance and development standards.

## Core Principles

### I. Zero-Latency Performance (NON-NEGOTIABLE)

Timer accuracy and responsiveness are the primary product pillars. All architectural
and implementation decisions MUST prioritize:

- Sub-millisecond timer tick precision (JavaScript's native timing within browser limits).
- Lightweight code and minimal DOM manipulation to eliminate browser lag.
- Primary reliance on Pusher (WebSockets) for real-time synchronization between the
  mobile Control Dashboard and the Stage Display over the internet (low overhead,
  cloud-based, 100+ concurrent connections, <100ms latency target).
- Profile and measure all timer logic; reject performance regressions without
  strong justification.

**Rationale**: A stage timer's core value is accuracy. Lag or jitter destroys user
trust and undermines the application's fundamental purpose. Pusher provides
internet-accessible real-time sync to support mobile phone control scenarios.

---

### II. Technology Stack Purity

Strict adherence to the defined technology stack ensures consistency, team onboarding,
and reducing technical debt:

**Frontend**:
- Semantic HTML5 (no presentational elements; accessibility first).
- Vanilla JavaScript ES6+ (no framework overhead; const/let, arrow functions,
  async/await, template literals, modern APIs only).
- Tailwind CSS utility classes exclusively (no inline styles except dynamically
  calculated values like progress bar widths via JavaScript).

**Backend**:
- PHP 8+ exclusively for RESTful JSON API endpoints (never for HTML rendering).
- Modern, well-structured code with proper error handling (try/catch blocks).
- No legacy PHP patterns; strict type hints; declarative code.

**Data & Real-Time**:
- MySQL for persistent storage and relational data.
- Pusher JS (client-side) and Pusher PHP SDK (server-side) for cross-device
  synchronization via WebSockets (supports mobile phone control over internet).

**Rationale**: Technology uniformity eliminates friction and context-switching;
maintains predictable performance characteristics.

---

### III. Security & Data Integrity (NON-NEGOTIABLE)

Database and user-facing operations MUST employ defense-in-depth practices:

- **All database queries MUST use PDO (PHP Data Objects) with prepared statements.**
  Never concatenate variables directly into SQL strings (SQL injection prevention).
- Validate and sanitize all incoming POST/GET data to prevent XSS attacks.
- Secure session handling; authentication tokens validated on every state-modifying
  request.
- Database schema enforces integrity via foreign keys and constraints (relational
  design enforced at the database layer).
- Error messages logged securely (never exposed to client without sanitization).

**Rationale**: Security is foundational; once compromised, no amount of performance
can restore user trust.

---

### IV. Frontend Architecture Standards

Frontend code MUST maintain a strict separation between business logic and UI concerns:

- DOM queries and mutations isolated to designated view/update functions.
- Timer calculation logic (elapsed time, countdown, sync state) lives in pure,
  testable functions independent of the DOM.
- Semantic HTML5 structure enforced: use `<header>`, `<main>`, `<section>`,
  `<button>`, `<input>`, `<label>` appropriate to context (never `<div>` for
  buttons or links; never `<span>` for semantic content).
- Tailwind CSS for ALL visual styling. Inspect element should **not** reveal any
  inline styles unless dynamically computing a dimension (% progress, etc.).
- Accessibility attributes (`aria-label`, `role`, `tabindex`) included where
  semantic HTML alone is insufficient.

**Rationale**: Separating logic from presentation makes code testable, maintainable,
and resilient to UI changes.

---

### V. Backend API Standards

PHP endpoints serve ONLY as a JSON API contract; never render HTML:

- RESTful URL design: `/api/v1/rooms`, `/api/v1/rooms/{id}`, etc.
- Request validation responds with `400 Bad Request` + error details (JSON).
- Responses MUST be valid JSON; include metadata (version, status, timestamp).
- Error responses follow a consistent schema: `{ "error": "...", "code": "...", "timestamp": "..." }`.
- All endpoints return explicit HTTP status codes: `200`, `201`, `400`, `401`,
  `403`, `404`, `500` as appropriate.
- Room creation, agenda CRUD, authentication, and timer sync exposed via distinct endpoints.

**Rationale**: A well-defined API contract enables clear client-side expectations
and facilitates future client diversity (web, mobile, etc.).

---

### VI. Database Design Standards

MySQL schema MUST enforce relational integrity and maintainability:

- Table names and column names use snake_case (e.g., `timer_rooms`, `event_agenda`,
  `room_id`).
- Foreign keys defined for all parent-child relationships (cascade delete/update
  as appropriate).
- Indexing strategy documented: primary keys, unique constraints, and lookups
  (room access, timer state queries).
- Schema migrations tracked in version control; schema changes peer-reviewed
  before deployment.
- No denormalization without justification; normalization preferred to reduce
  redundancy and sync errors.

**Rationale**: Disciplined database design prevents data corruption and simplifies
schema evolution.

---

## Development Philosophy

**Readability Over Cleverness**: Write code that is easy to read, understand, and
maintain. Comments should explain the *why* behind complex logic, particularly
for time-syncing functions that interact with the Pusher WebSocket state.

**Simple by Default**: Follow YAGNI (You Aren't Gonna Need It) principles. Implement
only what the spec requires; resist over-engineering.

**Testing Discipline**: Test-first approach preferred for critical paths (timer
accuracy, sync logic, API validation). Focus integration tests on room lifecycle,
timer state sync, and agenda manipulation.

---

## Governance

**Constitution as Authority**: This constitution supersedes all other coding practices
and conventions. No contradicting practices are acceptable without explicit governance
amendment.

**Amendment Process**:
1. Proposed amendment documented with rationale and impact analysis.
2. Review by project leads for consistency with project goals.
3. Version bump: MAJOR (principle removed/redefined), MINOR (new principle or
   significant expansion), or PATCH (clarification/wording).
4. Dependent templates (plan, spec, tasks) reviewed and updated if necessary.
5. Amendment date recorded; previous version archived in commit history.

**Verification in Code Review**:
- All PRs referencing this constitution MUST list affected principles.
- Code violating constitution MUST be rejected regardless of functional correctness.
- Performance regressions, security shortcuts, or schema violations are grounds
  for rejection.

**Runtime Guidance**: Development questions resolved via `.github/agents/` agent
files and coding standards documentation. Ambiguities escalated to constitution
maintenance before implementation begins.

---

**Version**: 1.1.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-03-19 (Architectural Pivot: BroadcastChannel → Pusher)
