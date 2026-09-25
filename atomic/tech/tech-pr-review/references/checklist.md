# tech-pr-review — Checklists per pass

Reference file for the `tech-pr-review` skill. Read the section for the pass you're doing. The items are prompts to look at, not findings to report: only report what you have verified in the code.

## 1. Intent and scope
- Does every requirement in the description or linked issue have matching code?
- Are there changes the description doesn't explain (refactors, formatting sweeps, dependency bumps)? Suggest splitting them out.
- Is a feature flag, migration, config or documentation change needed but missing?
- Does it change behaviour existing users or clients rely on? Is that stated?

## 2. Correctness
- **Boundaries:** empty collections, null/absent values, zero and negative numbers, maximum sizes, the first and last page.
- **Concurrency:** read-modify-write without locking or versioning, check-then-act races, shared mutable state, non-idempotent retries.
- **Transactions:** work that must be atomic spread across transactions, external calls (HTTP, gateway, queue) inside a DB transaction, missing rollback on failure.
- **Errors:** swallowed exceptions, generic `catch`, wrong HTTP status, errors that lose the cause, `finally` blocks that hide exceptions.
- **Money and time:** floating-point money, missing currency, rounding mode, local time instead of UTC, DST, time-zone-less timestamps.
- **State machines:** transitions not validated, an illegal state reachable through a different endpoint.
- **Resources:** unclosed streams or connections, missing timeouts on outbound calls, unbounded queries (no pagination or limit).

## 3. Security
- **Authorization:** every new endpoint has the correct role/ownership check. Customers can't read other customers' data (use `404`, not `403`, for other owners' resources).
- **Input:** validated at the boundary (size, format, enum values). No string-built SQL, shell, LDAP or path expressions.
- **Secrets:** no keys or tokens in code, tests, config or logs. No PII or card data in logs.
- **Web:** tokens stored as specified (e.g. in memory, not localStorage), no user HTML rendered unsafely, CORS not widened to `*` with credentials.
- **Webhooks and integrations:** signature verified before parsing, replay/duplicate handling.
- **Dependencies:** new libraries are maintained, not typosquats, pinned, with a compatible licence. Lockfile changes match the manifest changes.
- **Infra:** no public buckets or DB exposure, least-privilege IAM, no plaintext secrets in templates or tfvars.

## 4. Contract and architecture
- Paths, methods, DTO field names, status codes, pagination and error format match the API contract (for the web store: `webstore-api-contract`).
- Breaking API changes (removed or renamed fields, new required fields, changed status codes) are versioned or coordinated with clients.
- Layer rules: the domain has no framework imports, adapters don't call each other directly, and the application layer depends on ports, not implementations.
- No business logic in controllers, resources, components or SQL triggers when a use case should own it.
- Schema changes are consistent with the logical schema and don't edit already-applied migrations.

## 5. Tests
- New or changed behaviour has tests, including the error paths the code handles.
- The tests would actually fail if the logic were wrong (no asserting on mocks only, no `assertTrue(true)`, no snapshot-everything).
- Flakiness: `sleep`, real clocks, random data without a seed, ordering assumptions, shared state between tests.
- Test data doesn't depend on production-like secrets or external services without containers or mocks.
- Coverage of bug fixes: a regression test reproduces the original bug.

## 6. Maintainability and performance
- Names say what things are and do. There are no misleading names after the change.
- Duplicated logic that already exists elsewhere in the codebase (search before flagging).
- Dead code, commented-out code, leftover debug output, TODOs without an owner or issue.
- N+1 queries (look for repository calls inside loops), missing indexes for new filters or sorts, loading whole aggregates for a count.
- Unbounded memory: collecting full result sets, string concatenation in loops over large inputs.
- Front end: unnecessary re-renders from unstable props or keys, missing loading/error/empty states, missing accessibility (labels, roles, focus).

## Out of scope unless asked
- Formatting that a formatter or linter enforces.
- Personal style preferences with no readability impact.
- Rewrites of code the PR didn't touch. Mention a clearly related issue once, as a follow-up.
