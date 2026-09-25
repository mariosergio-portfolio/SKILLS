---
name: tech-arch-hexagonal
description: Use when the user invokes %tech-arch-hexagonal or asks about Hexagonal Architecture (Ports & Adapters) — the three-ring layer model, driving/driven adapters, input/output ports, dependency rules, folder structure, and how to split responsibilities across layers. Language-agnostic and domain-agnostic.
---

# Hexagonal Architecture — Layer Model (Ports & Adapters)

## When to use this skill
Activate when the user types `%tech-arch-hexagonal` or asks about structuring an application using Hexagonal Architecture (Ports & Adapters): rings, ports, adapters, dependency rules, and folder layout. This skill is language-agnostic and domain-agnostic.

---

## Overview

Hexagonal Architecture organises code into three concentric rings. The inner rings define the business logic and its contracts; the outer ring handles all I/O and framework concerns. No inner ring ever depends on an outer one.

```
┌─────────────────────────────────────────────────────────┐
│                    DRIVING ADAPTERS                      │
│         (REST Controllers, CLI, Message Consumers)       │
└──────────────────────┬──────────────────────────────────┘
                       │  calls
              ┌────────▼────────┐
              │   INPUT PORTS   │  ← interfaces defining what the app can do
              ├─────────────────┤
              │                 │
              │   DOMAIN CORE   │  ← Entities, Value Objects, Domain Services,
              │                 │    Business Rules — NO framework dependencies
              │                 │
              ├─────────────────┤
              │  OUTPUT PORTS   │  ← interfaces defining what the app needs
              └────────┬────────┘
                       │  implemented by
┌──────────────────────▼──────────────────────────────────┐
│                   DRIVEN ADAPTERS                        │
│        (Repositories, REST Clients, File I/O, Cache)     │
└─────────────────────────────────────────────────────────┘
```

---

## The Three Rings

| Ring | Content | Rules |
|------|---------|-------|
| **Domain Core** | Entities, Value Objects, Domain Events, Domain Services | No imports from outer rings; pure business logic; no framework annotations |
| **Application** | Use-case implementations (services), Input Port interfaces, Output Port interfaces | Depends only on Domain Core; no infrastructure imports |
| **Infrastructure** | Driving adapters (controllers, CLI), Driven adapters (persistence, messaging, cache) | Implements Output Ports; calls Input Ports; all framework/library code lives here |

---

## Ports

### Input Ports
- Interfaces that define **what the application can do** — the use-case contracts.
- Defined in the Application ring.
- Implemented by Application service classes (use-case implementations).
- Called by Driving Adapters.
- Organise one interface per aggregate/entity, grouping all operations for that entity on the same interface.

### Output Ports
- Interfaces that define **what the application needs from the outside world** — persistence, messaging, external APIs.
- Defined in the Application ring.
- Implemented by Driven Adapters in the Infrastructure ring.
- Called by Application service classes.
- Shared across modules; never duplicated per use case.

---

## Adapters

### Driving Adapters (Primary)
- Trigger the application from the outside.
- Typical examples: REST controllers, GraphQL resolvers, CLI commands, message/event consumers.
- Responsibilities: receive external input → call an Input Port → map the result back to the external format.
- **No business logic** in driving adapters — they are pure translators.
- Receive Input Port interfaces via constructor injection; never reference a use-case implementation class directly.

### Driven Adapters (Secondary)
- Called by the application to reach the outside world.
- Typical examples: ORM repositories, SQL query objects, REST API clients, file exporters, cache clients.
- Implement Output Port interfaces.
- Contain all persistence/infrastructure-specific code; domain models are never passed to them directly — use mappers.

---

## Dependency Rules

1. **Domain Core** has zero outward dependencies — it never imports from Application or Infrastructure.
2. **Application** depends on Domain Core only.
3. **Infrastructure** depends on Application (to call Input Ports and implement Output Ports) and on Domain Core (for model types).
4. Driving adapters receive an Input Port **interface** via constructor injection — never a concrete implementation class.
5. Application services receive Output Port **interfaces** via constructor injection — never a concrete adapter class.
6. Dependency direction always points **inward** (toward the Domain Core).

---

## Canonical Folder Structure

```
<app>/
├── domain/
│   ├── model/          ← Entities, Value Objects, Enums (no framework annotations)
│   ├── event/          ← Domain Events
│   └── service/        ← Stateless Domain Services
│
├── application/
│   ├── port/
│   │   ├── in/         ← Input Port interfaces (one per aggregate/entity)
│   │   └── out/        ← Output Port interfaces — SHARED across all modules
│   └── service/        ← Input Port implementations (use-case services)
│
├── infrastructure/
│   ├── rest/           ← Driving adapters: controllers + DTOs + mappers (split by module)
│   ├── persistence/    ← Driven adapters: ORM entities, repositories, adapters — SHARED
│   └── config/         ← Framework configuration, DI wiring, security
│
└── shared/
    ├── exception/      ← Cross-cutting exceptions
    └── util/           ← Pure utility functions
```

### What to split by module vs. keep shared

| Artefact | Split by module? | Reason |
|----------|-----------------|--------|
| `domain/` | No | All modules operate on the same entities — duplication creates drift |
| `application/port/out/` | No | Output ports express what the domain needs from persistence, independent of which use case calls them |
| `application/port/in/` | Yes | Each module exposes a distinct set of use-case contracts |
| `application/service/` | Yes | Module-specific use-case implementations |
| `infrastructure/rest/` | Yes | Each module owns its own HTTP endpoints, controllers, and DTOs |
| `infrastructure/persistence/` | No | Persistence is a single cross-cutting concern |

---

## Testing Strategy

| Level | Scope | What to mock |
|-------|-------|--------------|
| **Unit** | Application service (use-case) + Domain service | All Output Ports mocked; no I/O |
| **Integration** | Driven adapters (persistence, messaging) | Real database/broker (e.g. in-memory or test container); no HTTP |
| **API / E2E** | Driving adapters (controllers) | Full stack running; assert via HTTP client |

- Aim for high coverage on the Domain Core and Application service layers — this is where business rules live.
- Integration and E2E tests cover critical paths only; keep them few and focused.

---

## How to use this skill
1. Apply this layer model and dependency rules to any application regardless of programming language or domain.
2. Respond and assist in English unless the user requests another language.
3. Await further instructions from the user and execute them accordingly.
