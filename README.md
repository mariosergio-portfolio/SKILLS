# Skills library

A library of 27 [Claude Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) for designing and building software, using a full e-commerce web store as the reference system.

Skills come in two layers:

- **Atomic skills** each cover one concern: a business domain, a technology, or an infrastructure target. They never depend on a specific stack, so you can reuse them in any project.
- **Composite skills** combine atomic skills into a concrete implementation, for example "the web store as a Java REST API". They tell Claude which atomic skills to load and add the project-specific decisions: package names, endpoints, folder layout, and so on.

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               COMPOSITE LAYER                                │
│                  "build the web store with this technology"                  │
│                                                                              │
│  webstore-arch-java-api   webstore-arch-kotlin-quarkus-api                   │
│  webstore-arch-react      webstore-database-postgres                         │
└───────────────┬───────────────────────┬───────────────────────┬──────────────┘
                │ loads                 │ loads                 │ loads
                ▼                       ▼                       ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐
│  ATOMIC · DOMAIN        │ │  ATOMIC · TECH          │ │  ATOMIC · INFRA      │
│  what the system does   │ │  how to build it        │ │  where it runs       │
│                         │ │                         │ │                      │
│  webstore-domain        │ │  architecture           │ │  infra-iac-          │
│  webstore-catalog       │ │    tech-arch-hexagonal  │ │    specification     │
│  webstore-cart          │ │    tech-good-practices  │ │  infra-terraform     │
│  webstore-checkout      │ │  databases              │ │  infra-aws-ec2       │
│  webstore-orders        │ │    tech-database-*      │ │  infra-aws-fargate   │
│  webstore-payments      │ │  stacks                 │ │                      │
│  webstore-inventory     │ │    tech-stack-*         │ │                      │
│  webstore-backoffice    │ │                         │ │                      │
│  webstore-data-structure│ │                         │ │                      │
└─────────────────────────┘ └─────────────────────────┘ └──────────────────────┘
   technology-agnostic         domain-agnostic             app-agnostic
```

### How the skills depend on each other

```
COMPOSITES
──────────
webstore-arch-java-api ─────────────┬─► tech-arch-hexagonal
                                    ├─► tech-good-practices
                                    ├─► tech-stack-java-spring-rest
                                    ├─► webstore-data-structure
                                    └─► webstore-domain + all 7 module skills

webstore-arch-kotlin-quarkus-api ───┬─► tech-arch-hexagonal
                                    ├─► tech-good-practices
                                    ├─► tech-stack-kotlin-quarkus-rest
                                    ├─► webstore-data-structure
                                    └─► webstore-domain + all 7 module skills

webstore-arch-react ────────────────┬─► tech-stack-react
                                    ├─► tech-good-practices
                                    ├─► webstore-arch-java-api   (the REST API contract)
                                    └─► webstore-domain + all 7 module skills

webstore-database-postgres ─────────┬─► webstore-data-structure
                                    └─► tech-database-postgres

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

 webstore-data-structure  (logical schema, any database engine)
         │  concrete implementation
         ▼
 webstore-database-postgres  +  tech-database-postgres
 (other engines: pair it with tech-database-oracle)

INFRA
─────
                    infra-iac-specification
                 (any cloud provider, any IaC tool)
                               │ implemented by
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     infra-terraform     infra-aws-ec2     infra-aws-fargate
     (Terraform, any     (CloudFormation,  (CloudFormation,
      provider)           ECS on EC2)       ECS on Fargate)
```

Four atomic tech skills (`tech-stack-dotnet`, `tech-stack-java-spa`, `tech-stack-android` and `tech-database-oracle`) don't have a web store composite yet. You can use them on their own, or build new composites on top of them.

---

## Skill catalogue

| Skill | Layer | Category | What it gives Claude | Loads / builds on | Reference files |
|---|---|---|---|---|---|
| `webstore-domain` | Atomic | Domain | Entities, business rules, value objects, module map | — | — |
| `webstore-catalog` | Atomic | Domain | Products, categories, search, filters | `webstore-domain` | — |
| `webstore-cart` | Atomic | Domain | Cart lifecycle, coupons, price refresh, cart merge on login | `webstore-domain` | — |
| `webstore-checkout` | Atomic | Domain | Order placement, stock deduction, price freeze | `webstore-domain`, `webstore-cart` | — |
| `webstore-orders` | Atomic | Domain | Order status machine, history, cancellation | `webstore-domain` | — |
| `webstore-payments` | Atomic | Domain | Payment gateways, webhooks, idempotency, refunds | `webstore-domain` | — |
| `webstore-inventory` | Atomic | Domain | Stock levels, reservation, restock, audit log | `webstore-domain` | — |
| `webstore-backoffice` | Atomic | Domain | Admin screens for products, orders, stock, customers, coupons, reports | `webstore-domain` + 4 modules | — |
| `webstore-data-structure` | Atomic | Domain | Logical relational schema (13 tables), any database engine | `webstore-domain` | — |
| `tech-arch-hexagonal` | Atomic | Tech · Architecture | Ports & Adapters layer model and dependency rules | — | — |
| `tech-good-practices` | Atomic | Tech · Architecture | SOLID, API design, testing strategy, clean code | — | — |
| `tech-database-postgres` | Atomic | Tech · Database | PostgreSQL DDL conventions and features | — | — |
| `tech-database-oracle` | Atomic | Tech · Database | Oracle DDL conventions and features | — | — |
| `tech-stack-java-spring-rest` | Atomic | Tech · Stack | Java 25 + Spring Boot 4.1 REST API | — | `maven-dependencies`, `configuration` |
| `tech-stack-kotlin-quarkus-rest` | Atomic | Tech · Stack | Kotlin 2.4 + Quarkus 3.38 REST API | — | — |
| `tech-stack-dotnet` | Atomic | Tech · Stack | C# 14 + ASP.NET Core 10 + EF Core 10 REST API | — | — |
| `tech-stack-java-spa` | Atomic | Tech · Stack | Java 25 + Spring Boot + Vaadin 25 server-side SPA | — | — |
| `tech-stack-react` | Atomic | Tech · Stack | React 19 + TypeScript + Vite front end | — | — |
| `tech-stack-android` | Atomic | Tech · Stack | Kotlin + Jetpack Compose, Clean Architecture + MVVM | — | — |
| `infra-iac-specification` | Atomic | Infra | Infrastructure contract for any cloud or IaC tool | — | `cicd-pipeline` |
| `infra-terraform` | Atomic | Infra | Terraform implementation of the spec | `infra-iac-specification` | `module-interfaces`, `variables`, `root-modules`, `deployment` |
| `infra-aws-ec2` | Atomic | Infra | AWS CloudFormation deployment on ECS with the EC2 launch type | `infra-iac-specification` | `stack-details`, `deploy-script`, `operations` |
| `infra-aws-fargate` | Atomic | Infra | AWS CloudFormation deployment on ECS with the Fargate launch type | `infra-iac-specification` | `stack-details`, `deploy-script`, `operations` |
| `webstore-arch-java-api` | Composite | Web store | Web store back end in Java + Spring, hexagonal | hexagonal, good practices, Java stack, domain | — |
| `webstore-arch-kotlin-quarkus-api` | Composite | Web store | Web store back end in Kotlin + Quarkus, hexagonal | hexagonal, good practices, Quarkus stack, domain | `driven-adapters`, `testing` |
| `webstore-arch-react` | Composite | Web store | Web store front end in React | React stack, good practices, Java API, domain | `project-structure` |
| `webstore-database-postgres` | Composite | Web store | Web store schema as PostgreSQL DDL + Flyway | data structure, PostgreSQL | — |

---

## Skill descriptions

### Domain: web store (`atomic/domain/webstore/`)

These skills describe **what** the business does, with no technology choices. Each one is the single source of truth for its module, and every composite reads them.

- **`webstore-domain`**: The foundation of the domain layer. It defines the core entities (Product, Category, Customer, Cart, CartItem, Coupon, Order, OrderItem, Payment), their value objects, the business rules, the domain events, and which module owns what. Load it before any other `webstore-*` skill.
- **`webstore-catalog`**: Product listing, full-text search, filtering and sorting, product detail pages, and the category tree. It also covers how the catalog is managed from the backoffice.
- **`webstore-cart`**: The whole cart lifecycle: adding, updating and removing items, applying and validating coupons, and refreshing prices when products change. It also covers anonymous vs logged-in carts and merging an anonymous cart into the customer's cart on login.
- **`webstore-checkout`**: The move from cart to order. It checks the cart, deducts stock atomically, freezes prices on the order lines, and clears the cart, all within clear transaction boundaries.
- **`webstore-orders`**: The order status machine and which status changes are allowed. It also covers a customer's order history, the rules for cancelling an order, and how admins manage orders.
- **`webstore-payments`**: Starting a payment with Stripe, PayPal or Mercado Pago, and processing the gateway's webhook callbacks. It also covers idempotency keys so a payment is never charged twice, refunds, and how payment status maps to order status.
- **`webstore-inventory`**: Stock levels and reservations, deducting stock at checkout with optimistic locking, restocking, and low-stock alerts. Admins can adjust stock, and every change is recorded in an audit log.
- **`webstore-backoffice`**: Admin-side operations across modules: product and category CRUD, managing orders, adjusting inventory, managing customers and coupons, and reporting.
- **`webstore-data-structure`**: The logical relational schema: 13 tables (customer, address, category, product, image, shipping method, coupon, cart, cart item, order, order item, payment, inventory audit log). It gives columns, logical types, keys, constraints and usage rules, without committing to a database engine.

### Tech: architecture (`atomic/tech/`)

- **`tech-arch-hexagonal`**: Hexagonal architecture (Ports & Adapters) for any language. It covers the three rings (domain, application, adapters), driving vs driven adapters, input and output ports, the dependency rule, the folder layout, and which responsibilities belong in which ring.
- **`tech-good-practices`**: Engineering rules for any language or domain: SOLID principles, REST API design (resource naming, status codes, error format, pagination), testing strategy, and clean-code rules.

### Tech: databases

- **`tech-database-postgres`**: A reference for designing PostgreSQL schemas: naming conventions, choosing data types, constraints, indexes, partitioning, sequences and identity columns, ENUM types, triggers, and optimistic-locking patterns.
- **`tech-database-oracle`**: The same kind of reference for Oracle: naming, data types, constraints, indexes, partitioning, sequences, triggers, and Oracle-only features such as optimistic locking with `SQL%ROWCOUNT`.

### Tech: stacks

- **`tech-stack-java-spring-rest`**: A Java 25 + Spring Boot 4.1 REST API. It covers the stack and versions, coding conventions, OpenAPI/Swagger, an H2 database for development, MapStruct and JPA patterns, Maven dependencies, and profile configuration. The last two are in reference files.
- **`tech-stack-kotlin-quarkus-rest`**: A Kotlin 2.4 + Quarkus 3.38 REST API. It covers the Gradle Kotlin DSL build, Panache/JPA, MapStruct, OpenAPI, and `%dev`/`%test`/`%prod` profile configuration. The app is ready to compile to a GraalVM native image.
- **`tech-stack-dotnet`**: A .NET 10 (LTS) REST API with C# 14 and ASP.NET Core 10. It covers EF Core 10, FluentValidation, xUnit v3, and Testcontainers for integration tests.
- **`tech-stack-java-spa`**: A server-side single-page app built with Java 25, Spring Boot and Vaadin 25 (Flow), with no separate front-end build. It covers security setup and UI testing with Karibu-Testing.
- **`tech-stack-react`**: A React 19 + TypeScript + Vite front end. It uses React Router, Zustand for app state, TanStack Query for server data, React Hook Form + Zod for forms, Axios, and Tailwind. Testing uses Vitest, React Testing Library and Playwright. It also sets project-structure conventions.
- **`tech-stack-android`**: A native Android app in Kotlin with Jetpack Compose, using Clean Architecture with MVVM. It covers Hilt, Room, Retrofit, Coroutines/Flow and WorkManager, targeting SDK 36 with a minimum of SDK 26.

### Infra (`atomic/infra/`)

- **`infra-iac-specification`**: The infrastructure contract for a full-stack app made of several microservices, independent of any cloud provider or IaC tool. It defines the architecture model (one product, many services), networking, container compute, the image registry, the CI/CD pipeline, the relational database, identity and access, secrets, observability, deployment tiers, naming, and deployment order. The tool- and provider-specific skills below implement it.
- **`infra-terraform`**: Implements the spec with Terraform in three layers: abstract module interfaces, provider implementations, and root modules. It covers remote state and locking, the workspace strategy, variable conventions, keeping secrets out of tfvars and state, and switching cloud providers.
- **`infra-aws-ec2`**: Implements the spec on AWS with CloudFormation. Services run on ECS with the EC2 launch type (Auto Scaling group + capacity provider) behind CloudFront, S3 and a load balancer. The data layer is Aurora PostgreSQL, ElastiCache and OpenSearch, plus Lambda. CI/CD uses CodeBuild + ECR, with image tags stored in SSM Parameter Store. It suits steady, high-utilisation workloads.
- **`infra-aws-fargate`**: Implements the same spec on ECS Fargate, so there are no EC2 instances to manage. It's the cost-effective choice for dev and test and for variable load.

### Composite: web store (`composite/webstore/`)

- **`webstore-arch-java-api`**: The web store back end as a Java + Spring REST API using hexagonal architecture. It sets the project structure, domain entities, port and adapter naming, the REST endpoint map, and configuration, and says which atomic skill to load for each concern.
- **`webstore-arch-kotlin-quarkus-api`**: The same back end built in Kotlin + Quarkus. It includes Kotlin data classes, port interfaces, application services, REST resources, Panache adapters, MapStruct mappers, the exception mapper, `application.properties`, and the testing strategy.
- **`webstore-arch-react`**: The web store front end in React. It maps domain types to TypeScript, aligns API calls with `webstore-arch-java-api`, and organises code by module. It covers auth and session handling, cart behaviour, the checkout flow, admin order status changes, environment variables, and routes.
- **`webstore-database-postgres`**: The `webstore-data-structure` schema implemented in PostgreSQL. It covers concrete column types, DDL scripts, indexes, constraints and triggers, and how the Flyway migrations are organised.

---

## Layout on disk

```
skills/
├── atomic/
│   ├── domain/webstore/<skill>/SKILL.md
│   ├── tech/<skill>/SKILL.md
│   └── infra/<skill>/SKILL.md [+ references/*.md]
├── composite/webstore/<skill>/SKILL.md [+ references/*.md]
├── tools/validate-skills.js      compliance checker
├── install.sh / install.ps1      flatten + copy into a Claude skills folder
└── README.md
```

A skill's `references/` files hold long detail (templates, full dependency lists, scripts). Claude reads them only when the `SKILL.md` points it there for the task at hand.

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

Run the install again after editing a skill.

## Use

Claude picks a skill automatically when your request matches its description. You can also call one directly:

```
/webstore-arch-java-api implement the cart module
/webstore-database-postgres generate the Flyway migration for the order tables
/infra-aws-fargate create the stacks for a dev environment
```

When you call a composite skill, Claude loads the atomic skills it lists, so a single call brings in the architecture, the stack and the domain rules.

## Rules for adding a skill

The validator (`node tools/validate-skills.js`) enforces these:

- The folder name equals the frontmatter `name`: lowercase letters, digits and hyphens, at most 64 characters.
- `description` says what the skill covers and when to use it ("Use when ..."), at most 1024 characters, with no angle brackets.
- The `SKILL.md` body stays under 500 lines. Move detail into `references/*.md` and link to it from `SKILL.md`.
- Reference other skills by plain name (`` `tech-good-practices` ``), never with the old `%name` syntax.
- Skills are never nested inside another skill's folder.
- Put atomic skills under `atomic/<domain|tech|infra>/`. A composite belongs under `composite/<system>/` and should list the atomic skills it loads in a "Foundation skills" block near the top.
