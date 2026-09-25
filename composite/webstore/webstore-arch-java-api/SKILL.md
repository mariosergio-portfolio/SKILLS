---
name: webstore-arch-java-api
description: Blueprint for building the web store back end in Java 25 + Spring Boot with hexagonal architecture: package layout, naming, ports and adapters per module, controller split, configuration, and a step-by-step workflow with done criteria. Use when implementing or extending the web store API in Java/Spring.
---

# Web Store — Java API Implementation

## Loading strategy

> Skills named below are sibling skills in this library. Load them with the Skill tool (or `/<skill-name>`) when the table says so; never guess their content.

Load **only what the current task touches**. Loading every module skill up front floods the context and buries the rules that matter.

| Task | Load in addition to this skill |
|---|---|
| Any task that touches an endpoint | `webstore-api-contract` (read only the sections for the module) |
| Scaffolding the project or changing build/config | `tech-stack-java-spring-rest`, `tech-arch-hexagonal` |
| Implementing or changing a module | `webstore-domain` + that module's skill (e.g. `webstore-cart`). Checkout also needs `webstore-cart` and `webstore-inventory`. Back-office work needs the module it administers. |
| Persistence, entities, migrations | `webstore-data-structure`, plus `tech-database-postgres` on PostgreSQL |
| Code review or refactoring | `tech-good-practices`, `tech-arch-hexagonal` |

---

## Application

- **Artifact name:** `webstore-java-api`
- **Package prefix:** `com.mycompany.webstore`

---

## Project Structure

```
webstore/
├── domain/                           ← SHARED — no framework annotations
│   ├── model/                        ← Product, Category, Cart, CartItem,
│   │                                   Order, OrderItem, Payment, Customer,
│   │                                   Coupon, Address, ShippingMethod,
│   │                                   InventoryAuditLog
│   ├── event/                        ← OrderPlaced, OrderPaid, OrderCancelled,
│   │                                   StockReduced, StockRestored, StockBelowThreshold,
│   │                                   CartMerged, PaymentFailed
│   └── service/                      ← Domain services (e.g. OrderTotalCalculator,
│                                        CouponValidator, StockChecker)
│
├── application/
│   ├── port/
│   │   ├── in/                       ← One interface per aggregate/module
│   │   │   ├── ProductPort
│   │   │   ├── CategoryPort
│   │   │   ├── CartPort
│   │   │   ├── CheckoutPort
│   │   │   ├── OrderPort
│   │   │   ├── PaymentPort
│   │   │   ├── InventoryPort
│   │   │   └── CustomerPort
│   │   └── out/                      ← Output ports (driven)
│   │       ├── ProductRepository
│   │       ├── CategoryRepository
│   │       ├── CartRepository
│   │       ├── OrderRepository
│   │       ├── PaymentRepository
│   │       ├── CustomerRepository
│   │       ├── CouponRepository
│   │       ├── InventoryAuditRepository
│   │       └── PaymentGatewayPort     ← external gateway abstraction
│   └── service/                      ← One impl per input port
│       ├── ProductPortImpl
│       ├── CategoryPortImpl
│       ├── CartPortImpl
│       ├── CheckoutPortImpl
│       ├── OrderPortImpl
│       ├── PaymentPortImpl
│       ├── InventoryPortImpl
│       └── CustomerPortImpl
│
├── infrastructure/
│   ├── rest/                         ← Driving adapters — split by business module
│   │   ├── catalog/                  ← ProductController, CategoryController + DTOs
│   │   ├── cart/                     ← CartController + DTOs
│   │   ├── checkout/                 ← CheckoutController + DTOs
│   │   ├── orders/                   ← OrderController, AdminOrderController + DTOs
│   │   ├── payments/                 ← PaymentController, WebhookController + DTOs
│   │   ├── inventory/                ← AdminInventoryController + DTOs
│   │   └── customers/                ← CustomerController, AuthController + DTOs
│   ├── persistence/                  ← SHARED driven adapters
│   │   ├── entity/                   ← {Entity}JpaEntity classes
│   │   ├── repository/               ← Spring Data {Entity}JpaRepository interfaces
│   │   └── adapter/                  ← {Entity}PersistenceAdapterImpl
│   ├── gateway/                      ← PaymentGatewayPort implementations
│   │   ├── stripe/                   ← StripeGatewayAdapter
│   │   ├── paypal/                   ← PayPalGatewayAdapter
│   │   └── mercadopago/              ← MercadoPagoGatewayAdapter
│   └── config/                       ← Spring beans, security, OpenAPI, Redis, H2ConsoleConfig
│
└── shared/
    ├── exception/                    ← ResourceNotFoundException, BusinessRuleException,
    │                                   InsufficientStockException, InvalidStatusTransitionException
    └── util/
```

---

## Naming Conventions

| Artefact | Example |
|---|---|
| Domain entity | `Product`, `Order`, `CartItem`, `Payment`, `Customer` |
| Input Port | `ProductPort`, `CartPort`, `CheckoutPort`, `OrderPort` |
| Input Port impl | `ProductPortImpl`, `CartPortImpl` |
| Output Port | `ProductRepository`, `PaymentRepository` |
| External Port | `PaymentGatewayPort` |
| Controller | `ProductController`, `CartController`, `WebhookController` |
| Persistence adapter | `ProductPersistenceAdapterImpl`, `OrderPersistenceAdapterImpl` |
| Gateway adapter | `StripeGatewayAdapter`, `PayPalGatewayAdapter` |
| JPA entity | `ProductJpaEntity`, `OrderJpaEntity`, `CartJpaEntity` |
| Request / Response DTOs | `ProductRequest`, `ProductResponse`, `PlaceOrderRequest` |
| MapStruct mappers | `ProductRestMapper`, `ProductPersistenceMapper` |

---

## REST Endpoints

Implement exactly the endpoints, access rules, DTOs, pagination shape and RFC 9457 error format in the `webstore-api-contract` skill. Do not keep a copy of the endpoint table here; load the contract section for the module you are working on.

Controller split (one package per module under `infrastructure/rest/`):

| Package | Controllers | Contract section |
|---|---|---|
| `catalog` | `ProductController`, `CategoryController`, `ShippingMethodController`, `AdminProductController`, `AdminCategoryController` | Catalog, Admin — catalog |
| `cart` | `CartController` | Cart |
| `checkout` | `CheckoutController` | Checkout and orders (`POST /api/orders`) |
| `orders` | `OrderController`, `AdminOrderController` | Checkout and orders, Admin — orders |
| `payments` | `PaymentController`, `WebhookController` | Payments |
| `inventory` | `AdminInventoryController` | Admin — inventory |
| `customers` | `AuthController`, `CustomerController`, `AdminCustomerController`, `AdminCouponController`, `AdminReportController` | Auth and account, Admin — customers, coupons, reports |

Cart endpoints must accept anonymous requests identified by the `sessionId` cookie; configure Spring Security so `/api/cart/**` is `permitAll()` and the cart service resolves the caller from JWT or cookie.

---

## OpenAPI Config

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI webstoreOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Web Store API")
                        .description("REST API for the Web Store e-commerce system")
                        .version("1.0.0"));
    }
}
```

Add `@Tag(name = "Catalog")`, `@Tag(name = "Cart")`, etc. to each `@RestController`.

---

## `application.yml` Configuration

### `application.yml` (base)

```yaml
spring:
  application:
    name: webstore-java
  profiles:
    active: prod
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8080

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    tags-sorter: alpha
    operations-sorter: alpha
  packages-to-scan: com.mycompany.webstore.infrastructure.rest
```

### `application-prod.yml` (PostgreSQL)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/webstore
    username: postgres
    password:
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    database-platform: org.hibernate.dialect.PostgreSQLDialect
  redis:
    host: localhost
    port: 6379
```

### `application-dev.yml` (H2 + no Redis)

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:webstoredb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: true
    database-platform: org.hibernate.dialect.H2Dialect
    properties:
      hibernate:
        format_sql: true
  flyway:
    enabled: false
```

> Activate dev profile with `--spring.profiles.active=dev`. H2 console at `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:webstoredb`, user: `sa`, no password).
> For Maven deps, `SecurityConfig`, and `H2ConsoleConfig` see `tech-stack-java-spring-rest`.
> In dev, Cart may use an in-memory map instead of Redis; inject a `CartRepository` that switches implementation by profile.

---

## Workflow — implementing or changing a module

1. **Scope.** Identify the module and its use cases from the module skill. If the request is ambiguous (which use cases? admin side too?), ask before coding.
2. **Domain.** Add or adjust entities and value objects in `domain/model/`, expressing invariants as methods. Write plain unit tests for every business rule in the module skill, with no Spring context.
3. **Ports.** Update the input port in `application/port/in/` and the output ports in `application/port/out/`.
4. **Service.** Implement `<Module>PortImpl` with the transaction boundary at the use-case level. Unit-test it against in-memory fakes of the output ports.
5. **Persistence adapter.** Add the JPA entity, repository, mapper and `<Entity>PersistenceAdapterImpl`. For any schema change, add a new Flyway migration; never edit an applied one.
6. **REST adapter.** Add the controller and DTOs exactly as in the `webstore-api-contract` section: same path, method, access rule, status codes and RFC 9457 errors. Add nothing the contract doesn't list.
7. **Tests.** Write API tests (`@SpringBootTest` + `MockMvc`/`RestTestClient`) for each endpoint: the happy path plus every error status the contract documents for it. Use Testcontainers PostgreSQL for persistence tests.
8. **Verify.** Run `./mvnw verify`, then open `/v3/api-docs` and compare the module's paths with the contract.

## Done criteria

A module is done only when all of these hold:

- [ ] `domain/` has no Spring, JPA or HTTP imports (`grep -rE "org\.springframework|jakarta\.persistence" <domain dir>` returns nothing).
- [ ] Every endpoint in the module's contract section exists with the documented path, method, access rule and status codes, and there are no extra endpoints.
- [ ] Every business rule in the module skill has at least one unit test that fails when the rule is broken.
- [ ] Errors are RFC 9457 Problem Details with the contract's status codes. No stack traces or entity internals leak.
- [ ] Module-specific checks pass:
  - **checkout:** order creation and stock deduction share one transaction, the optimistic-lock conflict retries once then returns `409`, and order-line prices are frozen.
  - **cart:** every endpoint works without a JWT via the `sessionId` cookie, and `POST /api/cart/merge` sums quantities capped at stock.
  - **orders:** every status change goes through the state machine, and cancellation restores stock.
  - **payments:** webhooks verify the signature before parsing and are idempotent on `gatewayReference`. No card data is stored or logged.
  - **inventory:** every stock change writes an audit-log row.
- [ ] `./mvnw verify` is green with no new warnings, and there are no TODOs left in the changed code.

Architecture reminders: keep gateway-specific code behind `PaymentGatewayPort` in `infrastructure/gateway/`, and follow `webstore-checkout` for the `PlaceOrder` transaction boundary.
