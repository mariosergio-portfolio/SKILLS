---
name: webstore-arch-java-api
description: Use when the user invokes %webstore-arch-java-api or asks about implementing the web store in Java — project structure, domain entities, port/adapter naming, REST endpoints, and configuration for the e-commerce REST API.
---

# Web Store — Java API Implementation

## When to use this skill
Activate when the user types `%webstore-arch-java-api` or asks about implementing the web store back-end in Java.

**Always load these foundation skills first:**
- `%tech-arch-hexagonal` — hexagonal architecture, three rings, ports, adapters, dependency rules, folder layout
- `%tech-good-practices` — SOLID principles, clean code, API design, testing strategy
- `%tech-stack-java-spring-rest` — Java 25 + Spring Boot 4.1.x stack, Maven, OpenAPI, H2, MapStruct

**Load these web store domain skills for the module being implemented:**
- `%webstore-domain` — all entities, business rules, and module responsibilities
- `%webstore-catalog` — Module: products and categories
- `%webstore-cart` — Module: cart lifecycle and coupon logic
- `%webstore-checkout` — Module: order placement and price freeze
- `%webstore-orders` — Module: order lifecycle and status transitions
- `%webstore-payments` — Module: gateway integration and webhooks
- `%webstore-inventory` — Module: stock management and audit log
- `%webstore-backoffice` — Module: admin product/order/inventory/customer/coupon management and reports

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
│   │   ├── inventory/                ← InventoryController + DTOs
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

## REST Endpoint Summary

| Method | Path | Module | Description |
|---|---|---|---|
| `GET` / `POST` | `/api/products` | Catalog | List/search / create product |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/products/{id}` | Catalog | Detail / update / archive |
| `GET` / `POST` | `/api/categories` | Catalog | List / create category |
| `GET` / `PUT` / `DELETE` | `/api/categories/{id}` | Catalog | Detail / update / delete |
| `GET` | `/api/cart` | Cart | Get current cart |
| `POST` | `/api/cart/items` | Cart | Add item |
| `PATCH` / `DELETE` | `/api/cart/items/{itemId}` | Cart | Update qty / remove item |
| `POST` / `DELETE` | `/api/cart/coupon` | Cart | Apply / remove coupon |
| `POST` | `/api/cart/refresh` | Cart | Refresh prices |
| `POST` | `/api/orders` | Checkout | Place order |
| `GET` | `/api/orders` | Orders | Customer order list |
| `GET` / `DELETE` | `/api/orders/{id}` | Orders | Detail / cancel |
| `GET` | `/api/admin/orders` | Orders | Admin order list |
| `PATCH` | `/api/admin/orders/{id}/status` | Orders | Advance status |
| `POST` | `/api/payments` | Payments | Initiate payment |
| `GET` | `/api/payments/{orderId}` | Payments | Payment status |
| `POST` | `/api/payments/webhook/stripe` | Payments | Stripe webhook |
| `POST` | `/api/payments/webhook/paypal` | Payments | PayPal webhook |
| `POST` | `/api/payments/webhook/mercadopago` | Payments | Mercado Pago IPN |
| `GET` / `PATCH` | `/api/inventory/{productId}` | Inventory | Stock level / adjust |
| `GET` | `/api/inventory` | Inventory | All stock levels |

Use `?page=0&size=20&sort=name,asc` for pagination. Errors: RFC 9457 Problem Details.

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
> For Maven deps, `SecurityConfig`, and `H2ConsoleConfig` see `%tech-stack-java-spring-rest`.
> In dev, Cart may use an in-memory map instead of Redis; inject a `CartRepository` that switches implementation by profile.

---

## How to use this skill
1. Load `%tech-arch-hexagonal`, `%tech-good-practices`, and `%tech-stack-java-spring-rest` for the full technical foundation.
2. Load the relevant web store domain skills for the module being implemented.
3. Apply the project structure and naming conventions defined here to all web store Java implementation work.
4. Use `PaymentGatewayPort` to keep gateway-specific code isolated in `infrastructure/gateway/`.
5. Refer to `%webstore-data-structure` for the relational schema, DDL, and migration reference.
6. Refer to `%webstore-inventory` for optimistic locking patterns on stock deduction.
6. Use `%webstore-checkout` for the `PlaceOrder` transaction boundaries.
7. Respond and assist in English unless the user requests another language.
8. Await further instructions from the user and execute them accordingly.
