# Skills library

A library of 26 [Claude Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) for designing and building software, using a full e-commerce web store as the reference system.

Skills come in two layers:

- **Atomic skills** each cover one concern: a business domain, a technology, or an infrastructure target. You can reuse them in any project.
- **Composite skills** turn atomic skills into a concrete implementation, for example "the web store as a Java REST API". Each composite has three parts:
  - a **loading strategy**: which atomic skills to load for which task, and nothing more
  - the project-specific decisions: package names, folder layout, and so on
  - a **step-by-step workflow** ending in **done criteria** Claude can check

Every fact lives in exactly one skill. Endpoints live only in `webstore-api-contract`, business rules only in the module skills, and version pins only in the `tech-stack-*` skills. Composites point to those skills instead of copying them.

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               COMPOSITE LAYER                                │
│        "build the web store with this technology" — workflow + done          │
│                                                                              │
│  webstore-arch-java-api   webstore-arch-kotlin-quarkus-api                   │
│  webstore-arch-react                                                         │
└───────────────┬───────────────────────┬───────────────────────┬──────────────┘
                │ loads on demand       │ loads on demand       │
                ▼                       ▼                       ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐
│  ATOMIC · DOMAIN        │ │  ATOMIC · TECH          │ │  ATOMIC · INFRA      │
│  what the system does   │ │  how to build it        │ │  where it runs       │
│                         │ │                         │ │                      │
│  webstore-domain        │ │  architecture           │ │  infra-iac-          │
│  webstore-api-contract  │ │    tech-arch-hexagonal  │ │    specification     │
│  webstore-catalog       │ │    tech-good-practices  │ │  infra-terraform     │
│  webstore-cart          │ │  databases              │ │  infra-aws-ecs       │
│  webstore-checkout      │ │    tech-database-*      │ │   (EC2 or Fargate)   │
│  webstore-orders        │ │  stacks                 │ │                      │
│  webstore-payments      │ │    tech-stack-*         │ │                      │
│  webstore-inventory     │ │                         │ │                      │
│  webstore-backoffice    │ │                         │ │                      │
│  webstore-data-structure│ │                         │ │                      │
└─────────────────────────┘ └─────────────────────────┘ └──────────────────────┘
   technology-agnostic         domain-agnostic             app-agnostic
```

### How the skills depend on each other

```
COMPOSITES  (each loads only what the current task needs)
──────────
webstore-arch-java-api ─────────────┬─► webstore-api-contract      (any endpoint work)
                                    ├─► webstore-domain + ONE module skill
                                    ├─► tech-stack-java-spring-rest, tech-arch-hexagonal  (scaffolding)
                                    ├─► webstore-data-structure    (persistence)
                                    └─► tech-good-practices        (review)

webstore-arch-kotlin-quarkus-api ───┬─► webstore-api-contract
                                    ├─► webstore-domain + ONE module skill
                                    ├─► tech-stack-kotlin-quarkus-rest, tech-arch-hexagonal
                                    ├─► webstore-data-structure
                                    └─► tech-good-practices

webstore-arch-react ────────────────┬─► webstore-api-contract      (same contract as every back end)
                                    ├─► webstore-domain + ONE module skill
                                    ├─► tech-stack-react
                                    └─► tech-good-practices

DOMAIN
──────
                           webstore-domain
                    (entities, rules, value objects)
                                  │
    ┌──────────┬──────────┬───────┼───────────┬──────────┬─────────────┐
    ▼          ▼          ▼       ▼           ▼          ▼             ▼
 catalog     cart      orders  payments  inventory  checkout ──►cart  backoffice
                                                                       │
                                            catalog, orders, inventory,│
                                            payments  ◄────────────────┘

 webstore-api-contract ◄── every module's "API" section points here
 (all endpoints, roles, DTOs, pagination, errors)

 webstore-data-structure  (logical schema, any database engine)
         │  mapped to a concrete engine with
         ▼
 tech-database-postgres  or  tech-database-oracle

INFRA
─────
                    infra-iac-specification
                 (any cloud provider, any IaC tool)
                               │ implemented by
                  ┌────────────┴────────────┐
                  ▼                         ▼
           infra-terraform            infra-aws-ecs
           (Terraform, any            (CloudFormation + ECS;
            provider)                  launch-type-ec2.md / launch-type-fargate.md)
```

Some atomic skills have no web store composite yet: `tech-stack-dotnet`, `tech-stack-java-spa`, `tech-stack-android`, `tech-database-postgres` and `tech-database-oracle`. The back-end composites use the database skills when they need them. You can use these skills on their own, or build new composites on top of them.

---

## Skill catalogue

| Skill | Layer | Category | What it gives Claude | Builds on | Extra files |
|---|---|---|---|---|---|
| `webstore-domain` | Atomic | Domain | Entities, business rules, value objects, domain events, module map | — | — |
| `webstore-api-contract` | Atomic | Domain | **Every** endpoint, access rule, DTO, pagination shape and error format | `webstore-domain` | — |
| `webstore-catalog` | Atomic | Domain | Products, categories, search, visibility | `webstore-domain` | — |
| `webstore-cart` | Atomic | Domain | Cart lifecycle, coupons, price refresh, anonymous carts and merge | `webstore-domain` | — |
| `webstore-checkout` | Atomic | Domain | Atomic order placement, stock deduction, price freeze | `webstore-domain`, `webstore-cart` | — |
| `webstore-orders` | Atomic | Domain | Order status machine, cancellation, immutability | `webstore-domain` | — |
| `webstore-payments` | Atomic | Domain | Gateways, idempotent webhooks, refunds, card-data security | `webstore-domain` | — |
| `webstore-inventory` | Atomic | Domain | Stock levels, optimistic locking, reservations, audit log | `webstore-domain` | — |
| `webstore-backoffice` | Atomic | Domain | Admin operations, reports, the STAFF/MANAGER/ADMIN role model | `webstore-domain` + modules | — |
| `webstore-data-structure` | Atomic | Domain | Logical relational schema (13 tables), any database engine | `webstore-domain` | — |
| `tech-arch-hexagonal` | Atomic | Tech · Architecture | Ports & Adapters layer model and dependency rules | — | — |
| `tech-good-practices` | Atomic | Tech · Architecture | SOLID, API design, testing strategy, clean code | — | — |
| `tech-database-postgres` | Atomic | Tech · Database | PostgreSQL DDL conventions and features | — | — |
| `tech-database-oracle` | Atomic | Tech · Database | Oracle DDL conventions and features | — | — |
| `tech-stack-java-spring-rest` | Atomic | Tech · Stack | Java 25 + Spring Boot 4.1 REST API | — | `references/`: Maven, configuration |
| `tech-stack-kotlin-quarkus-rest` | Atomic | Tech · Stack | Kotlin 2.4 + Quarkus 3.38 REST API | — | — |
| `tech-stack-dotnet` | Atomic | Tech · Stack | C# 14 + ASP.NET Core 10 + EF Core 10 REST API | — | — |
| `tech-stack-java-spa` | Atomic | Tech · Stack | Java 25 + Spring Boot + Vaadin 25 server-side SPA | — | — |
| `tech-stack-react` | Atomic | Tech · Stack | React 19 + TypeScript + Vite front end | — | — |
| `tech-stack-android` | Atomic | Tech · Stack | Kotlin + Jetpack Compose, Clean Architecture + MVVM | — | — |
| `infra-iac-specification` | Atomic | Infra | Infrastructure contract for any cloud or IaC tool | — | `references/`: CI/CD pipeline |
| `infra-terraform` | Atomic | Infra | Terraform implementation of the spec | `infra-iac-specification` | `references/`: module interfaces, variables, root modules, deployment |
| `infra-aws-ecs` | Atomic | Infra | AWS CloudFormation + ECS implementation, EC2 or Fargate | `infra-iac-specification` | `references/`: stack details, deploy script, operations, one file per launch type |
| `webstore-arch-java-api` | Composite | Web store | Back end in Java + Spring, hexagonal, with workflow and done criteria | contract, domain, Java stack, hexagonal | — |
| `webstore-arch-kotlin-quarkus-api` | Composite | Web store | Back end in Kotlin + Quarkus, hexagonal, with workflow and done criteria | contract, domain, Quarkus stack, hexagonal | `references/`: driven adapters, testing |
| `webstore-arch-react` | Composite | Web store | Front end in React, with workflow and done criteria | contract, domain, React stack | `references/`: project structure |

---

## Skill descriptions

### Domain: web store (`atomic/domain/webstore/`)

These skills describe **what** the business does, with no technology choices. Each one is the single source of truth for its topic.

- **`webstore-domain`**: The foundation of the domain layer. It defines the core entities (Product, Category, Customer, Cart, CartItem, Coupon, Order, OrderItem, Payment), the value objects (Money, Address, ShippingMethod), the business rules, the domain events, and which module owns what.
- **`webstore-api-contract`**: The one place the HTTP API is defined, shared by every back end and front end. It covers every path and method; access levels (public, anonymous session, customer, staff, manager, admin); DTO shapes; the `PageResponse` shape; RFC 9457 errors and status codes; and the JWT and cart-session rules, including `POST /api/cart/merge`. To change the API, edit this skill first.
- **`webstore-catalog`**: Product listing, full-text search, filtering, sorting and pagination limits. Only `ACTIVE` products are visible to the public. It also covers the category tree.
- **`webstore-cart`**: Adding, updating and removing items, stock checks, coupon validation, and price refresh. Anonymous carts use a session cookie, and they merge into the customer's cart on login.
- **`webstore-checkout`**: The move from cart to order in a single transaction: check the cart, deduct stock with optimistic locking, freeze prices on the order lines, compute totals, and clear the cart. It also defines the `409`/`422` error scenarios.
- **`webstore-orders`**: The order status machine and which transitions are allowed. It covers customer vs admin cancellation (with stock restored), immutability after placement, and order history.
- **`webstore-payments`**: Starting a payment with Stripe, PayPal or Mercado Pago, signature-verified and idempotent webhooks, the payment status flow, refunds, and card-data security rules.
- **`webstore-inventory`**: Stock levels, deducting stock at checkout with optimistic locking, optional reservations, restocking, low-stock alerts, and manual adjustments recorded in an audit log.
- **`webstore-backoffice`**: Admin operations across modules (products, categories, orders, inventory, customers, coupons, reports) and the `STAFF` (read), `MANAGER` (revenue reports) and `ADMIN` (write) role model.
- **`webstore-data-structure`**: The logical relational schema: 13 tables with columns, logical types, keys, constraints and usage rules, for any database engine.

### Tech: architecture (`atomic/tech/`)

- **`tech-arch-hexagonal`**: Hexagonal architecture (Ports & Adapters) for any language. It covers the three rings (domain, application, adapters), driving vs driven adapters, input and output ports, the dependency rule, and the folder layout.
- **`tech-good-practices`**: The house engineering standards: SOLID, REST API design, testing strategy, and clean-code rules.

### Tech: databases

- **`tech-database-postgres`**: PostgreSQL DDL reference: naming conventions, data types, named constraints, indexes, partitioning, identity columns and sequences, ENUM types, triggers, optimistic locking, and anti-patterns.
- **`tech-database-oracle`**: The same kind of reference for Oracle, including optimistic locking with `SQL%ROWCOUNT` and other Oracle-only pitfalls.

### Tech: stacks

Each stack skill has the **only** version table for its stack, with a "last verified" line to fill in when you check the versions.

- **`tech-stack-java-spring-rest`**: Java 25 + Spring Boot 4.1: coding conventions, OpenAPI, an H2 console for development, MapStruct and JPA patterns, and a security baseline. Maven dependencies and configuration are in reference files.
- **`tech-stack-kotlin-quarkus-rest`**: Kotlin 2.4 + Quarkus 3.38: Gradle Kotlin DSL, Panache, MapStruct, OpenAPI, SmallRye JWT, and `%dev`/`%test`/`%prod` profiles.
- **`tech-stack-dotnet`**: .NET 10 (LTS), C# 14, ASP.NET Core 10, EF Core 10, FluentValidation, xUnit v3 and Testcontainers.
- **`tech-stack-java-spa`**: Java 25, Spring Boot and Vaadin 25 (Flow), with Spring Security for views and Karibu-Testing.
- **`tech-stack-react`**: React 19, TypeScript, Vite, React Router, Zustand, TanStack Query, React Hook Form + Zod, Axios, Tailwind, Vitest, React Testing Library and Playwright.
- **`tech-stack-android`**: Kotlin, Jetpack Compose, Clean Architecture + MVVM, Hilt, Room, Retrofit, Coroutines/Flow and WorkManager.

### Infra (`atomic/infra/`)

- **`infra-iac-specification`**: The infrastructure contract for a multi-microservice app, independent of any cloud provider or IaC tool. It covers networking, compute, the image registry, CI/CD, the database, IAM, secrets, observability, naming, and deployment order.
- **`infra-terraform`**: Implements the spec with Terraform in three layers: abstract module interfaces, provider implementations, and root modules. It also covers remote state and locking, workspaces, variable conventions, and keeping secrets out of tfvars and state.
- **`infra-aws-ecs`**: Implements the spec on AWS with CloudFormation. It covers the VPC, a shared ALB, per-service ECS services, Aurora PostgreSQL, CodeBuild + ECR, SSM-driven image tags, GitHub CodeConnections, the deploy script, and operations. Claude asks which **launch type** you want, then reads only that difference file:
  - `launch-type-fargate.md`: `awsvpc` networking and IP targets
  - `launch-type-ec2.md`: `bridge` networking, dynamic ports, and the Auto Scaling group, capacity provider and instance role

### Composite: web store (`composite/webstore/`)

- **`webstore-arch-java-api`**: The Java + Spring back end: package layout, naming, and the controller split per module. Its workflow runs domain → ports → service → persistence → REST → tests → verify, and ends with done criteria that include checks specific to each module.
- **`webstore-arch-kotlin-quarkus-api`**: The same for Kotlin + Quarkus: data classes, resources, Panache adapters, mappers, configuration, and web-store-specific rules, with the same workflow and done criteria.
- **`webstore-arch-react`**: The React front end: domain types, API client organisation against the contract, auth and cart session, the checkout flow, admin screens and routes. Its workflow runs types → API functions → query hooks → UI → routes → tests → verify.

---

## Layout on disk

```
skills/
├── atomic/
│   ├── domain/webstore/<skill>/SKILL.md
│   ├── tech/<skill>/SKILL.md [+ references/*.md]
│   └── infra/<skill>/SKILL.md [+ references/*.md]
├── composite/webstore/<skill>/SKILL.md [+ references/*.md]
├── evals/webstore-evals.json     behavioural test prompts + expectations
├── tools/validate-skills.js      compliance checker
├── install.sh / install.ps1      flatten + copy into a Claude skills folder
└── README.md
```

- `references/` holds long detail that Claude reads only when the `SKILL.md` points it there.

---

## Install

Claude only discovers skills one folder deep (`<skills-dir>/<skill-name>/SKILL.md`). The install scripts run the validator, then copy every skill flat into a skills folder.

```bash
./install.sh                    # ~/.claude/skills (every project)
./install.sh /path/to/project   # <project>/.claude/skills (one project, commit it to share)
```

```powershell
.\install.ps1
.\install.ps1 -Project C:\path\to\project
```

If PowerShell says running scripts is disabled, run the script once with `powershell -ExecutionPolicy Bypass -File .\install.ps1`. To allow local scripts permanently for your user, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Run the install again after editing a skill. If you already installed the older skills, delete `infra-aws-ec2`, `infra-aws-fargate` and `webstore-database-postgres` from the target folder. The first two were merged into `infra-aws-ecs`, and the third was removed.

## Use

Claude picks a skill automatically when your request matches its description. You can also call one directly:

```
/webstore-arch-java-api implement the cart module
/infra-aws-ecs create the stacks for a new catalog service on Fargate
```

A composite loads only the atomic skills the task needs, then follows its workflow until every done criterion holds.

## Test the skills

`evals/webstore-evals.json` holds realistic prompts, each with a list of expectations. For example: "cart endpoints work without a JWT", "the Stripe webhook verifies the signature before parsing", "admin writes live under /api/admin".

1. Run a prompt in a scratch project **with** the skills installed, and once **without** them as a baseline.
2. Check each expectation against what Claude produced.
3. When a case fails, fix the skill that owns that fact and run the case again.

You can also ask Claude to run the evals for you with the `skill-creator` skill.

## Rules for adding a skill

The validator (`node tools/validate-skills.js`) enforces the first five:

- The folder name equals the frontmatter `name`: lowercase letters, digits and hyphens, at most 64 characters.
- `description` starts with **what the skill contains** and ends with "Use when …", in at most 1024 characters with no angle brackets.
- The `SKILL.md` body stays under 500 lines. Move detail into `references/*.md`.
- Reference other skills by plain name (`` `tech-good-practices` ``). All links resolve.
- Skills are never nested inside another skill's folder.
- **One owner per fact.** Endpoints go in `webstore-api-contract`, business rules in their module skill, and versions in the `tech-stack-*` skill. Link to them; don't copy them.
- A composite has a **Loading strategy** table, a **Workflow**, and **Done criteria**.
