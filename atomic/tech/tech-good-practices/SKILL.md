---
name: tech-good-practices
description: The house engineering standards: SOLID, REST API design (resource naming, status codes, error format, pagination), testing pyramid and strategy, and clean-code rules. Use when writing or reviewing application code or API designs in projects that follow these house standards.
---

# Architecture Good Practices

## SOLID Principles

| Principle | Rule | Practical guideline |
|-----------|------|---------------------|
| **S — Single Responsibility** | A class has one and only one reason to change. | Controllers translate HTTP ↔ use-case call. Services orchestrate business logic. Repositories handle persistence. Never mix these concerns in one class. |
| **O — Open/Closed** | Open for extension, closed for modification. | Introduce new behaviour by adding new implementations (strategy, decorator, sealed type variant) — never by editing existing classes. |
| **L — Liskov Substitution** | Subtypes must be substitutable for their base types without altering correctness. | All implementations of an Output Port interface must be interchangeable — swapping a real repository for an in-memory one must not break any use case. |
| **I — Interface Segregation** | Clients must not be forced to depend on methods they do not use. | Define fine-grained port interfaces. Prefer `QueryRepository` + `CommandRepository` over one fat interface. No adapter should implement methods it does not need. |
| **D — Dependency Inversion** | High-level modules must not depend on low-level modules; both must depend on abstractions. | Domain Core and Application ring define interfaces. Infrastructure implements them. Inject always by interface — never by concrete class. |

---

## Dependency Injection Rules

- Always use **constructor injection** — never field injection or property injection.
- Inject **interfaces**, never concrete implementation classes.
- Keep constructors small: if a class needs more than 3–4 dependencies, it may have too many responsibilities (SRP violation).
- Register implementations in a DI container / composition root in the Infrastructure layer — not in Domain or Application.

---

## API Design Guidelines

### REST Conventions
- Map resources to domain entities; use plural nouns for collection endpoints (`/surveys`, `/questions`).
- Standard HTTP methods: `GET` (read), `POST` (create), `PATCH` (partial update), `PUT` (full replace), `DELETE`.
- Nested resources for owned sub-entities: `GET /surveys/{id}/questions`, `POST /surveys/{id}/questions`.
- Query parameters for filtering and pagination: `?locationId=`, `?roundId=`, `?page=`, `?size=`.
- Use HTTP status codes correctly:

| Code | When to use |
|------|-------------|
| 200 OK | Successful GET, PATCH, PUT |
| 201 Created | Successful POST (include `Location` header) |
| 204 No Content | Successful DELETE or action with no body |
| 400 Bad Request | Malformed request / validation error |
| 404 Not Found | Resource does not exist |
| 422 Unprocessable Entity | Request is well-formed but violates business rules |
| 500 Internal Server Error | Unexpected server-side failure |

### Controllers are thin
- Controller responsibility: receive request → validate input → call Input Port → map result → return response.
- **No business logic in controllers.**
- **No persistence calls in controllers.**
- All business orchestration lives in the Application service (use-case) layer.

### Error responses
- Always return a consistent error envelope with at least: `status`, `message`, `timestamp`.
- Use RFC 7807 Problem Details format where the framework supports it.
- Never expose internal stack traces or implementation details to clients.

---

## Clean Code Rules

### Naming
- Names must communicate intent — avoid abbreviations, single letters, and generic names (`data`, `info`, `manager`).
- Classes: nouns (`SurveyService`, `InterviewRepository`).
- Methods/functions: verb + noun (`createSurvey`, `findById`, `computeStatistics`).
- Booleans: `is`/`has`/`can` prefix (`isValid`, `hasAnswers`, `canSubmit`).

### Functions and methods
- Do one thing — if a method needs a comment explaining its sections, split it.
- Prefer short methods (< 20 lines as a guideline); extract helpers with meaningful names.
- Avoid boolean flag parameters — they signal the method does two things; split instead.
- Return early (guard clauses) instead of deeply nested `if` blocks.

### Immutability
- Prefer immutable data transfer objects (records, value objects) wherever the value does not change after creation.
- Domain entities may be mutable when the lifecycle requires state transitions, but keep mutation surface minimal.

### Null handling
- Avoid returning `null`; use `Optional<T>` (Java), nullable types (`T?`) with nullability enabled (.NET), or union return types.
- Never pass `null` as a method argument.

### Error handling
- Define custom unchecked (runtime) exceptions for domain and business rule violations — avoid generic exceptions.
- Throw exceptions at the point of detection; catch and translate only at boundaries (controller advice, middleware).
- Never swallow exceptions silently (`catch (e) {}`).

### Comments
- Code should be self-explanatory; comments are for the **why**, not the **what**.
- Remove commented-out code; use version control for history.

---

## Testing Good Practices

### Test naming
Use a consistent pattern that describes intent:
```
should_<expected result>_when_<condition>
```
Examples:
- `should_save_entity_when_all_fields_are_valid`
- `should_throw_not_found_when_entity_does_not_exist`
- `should_return_validation_error_when_end_date_before_start_date`

### Arrange / Act / Assert (AAA)
Structure every test in three clearly separated sections:
```
// Arrange — set up the preconditions
// Act     — invoke the unit under test
// Assert  — verify the outcome
```

### Test isolation
- Unit tests must have **no I/O** — no file system, no network, no database.
- Mock only what crosses a layer boundary (Output Port interfaces, external APIs).
- Do not mock the class under test or its domain collaborators.
- One logical assertion per test (multiple `assert` calls are fine if they verify the same logical outcome).

### Test pyramid
| Level | Quantity | Scope |
|-------|----------|-------|
| Unit | Many | Single class / function in isolation |
| Integration | Some | Interaction between layers (real DB, real cache) |
| E2E / API | Few | Complete user flow through HTTP |

- Prioritise unit and integration coverage over E2E.
- Slow tests belong at the top of the pyramid — keep them few and focused.

### TDD cycle
1. Write a failing test that expresses the desired behaviour.
2. Write the minimal implementation to make it pass.
3. Refactor — keep tests green.

