---
name: webstore-arch-kotlin-quarkus-api
description: Blueprint for building the web store back end in Kotlin + Quarkus with hexagonal architecture: package layout, data classes, ports, services, REST resources, Panache adapters, mappers, configuration, tests, and a step-by-step workflow with done criteria. Use when implementing or extending the web store API in Kotlin/Quarkus.
---

# Web Store — Kotlin + Quarkus API Implementation

## Loading strategy

> Skills named below are sibling skills in this library. Load them with the Skill tool (or `/<skill-name>`) when the table says so; never guess their content.

Load **only what the current task touches**. Loading every module skill up front floods the context and buries the rules that matter.

| Task | Load in addition to this skill |
|---|---|
| Any task that touches an endpoint | `webstore-api-contract` (read only the sections for the module) |
| Scaffolding the project or changing build/config | `tech-stack-kotlin-quarkus-rest`, `tech-arch-hexagonal` |
| Implementing or changing a module | `webstore-domain` + that module's skill (e.g. `webstore-cart`). Checkout also needs `webstore-cart` and `webstore-inventory`. Back-office work needs the module it administers. |
| Persistence, entities, migrations | `webstore-data-structure`, plus `tech-database-postgres` on PostgreSQL |
| Code review or refactoring | `tech-good-practices`, `tech-arch-hexagonal` |

---

## Application

- **Artifact name:** `webstore-kotlin-api`
- **Package prefix:** `com.mycompany.webstore`
- **Language / framework versions:** as pinned in `tech-stack-kotlin-quarkus-rest` (Technology Stack table)
- **Build:** Gradle (Kotlin DSL — `build.gradle.kts`)

---

## Project Structure

```
webstore/
├── domain/                           ← SHARED — no framework annotations
│   ├── model/                        ← Product, Category, Cart, CartItem,
│   │                                   Order, OrderItem, Payment, Customer,
│   │                                   Coupon, Address, Money, ShippingMethod,
│   │                                   InventoryAuditLog
│   ├── event/                        ← OrderPlaced, OrderPaid, OrderCancelled,
│   │                                   OrderShipped, StockReduced, StockRestored,
│   │                                   StockBelowThreshold, CartMerged, PaymentFailed
│   └── service/                      ← Stateless domain services:
│                                        OrderTotalCalculator, CouponValidator,
│                                        StockChecker
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
│   │   └── out/                      ← Output ports (driven) — SHARED
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
│   │   ├── catalog/                  ← ProductResource, CategoryResource + DTOs + mappers
│   │   ├── cart/                     ← CartResource + DTOs + mappers
│   │   ├── checkout/                 ← CheckoutResource + DTOs + mappers
│   │   ├── orders/                   ← OrderResource, AdminOrderResource + DTOs + mappers
│   │   ├── payments/                 ← PaymentResource, WebhookResource + DTOs + mappers
│   │   ├── inventory/                ← AdminInventoryResource + DTOs + mappers
│   │   └── customers/                ← CustomerResource, AuthResource + DTOs + mappers
│   ├── persistence/                  ← SHARED driven adapters
│   │   ├── entity/                   ← {Entity}JpaEntity classes
│   │   ├── repository/               ← Panache {Entity}PanacheRepository interfaces
│   │   └── adapter/                  ← {Entity}PersistenceAdapterImpl + {Entity}PersistenceMapper
│   ├── gateway/                      ← PaymentGatewayPort implementations
│   │   ├── stripe/                   ← StripeGatewayAdapter
│   │   ├── paypal/                   ← PayPalGatewayAdapter
│   │   └── mercadopago/              ← MercadoPagoGatewayAdapter
│   └── config/                       ← CDI producers, security, OpenAPI, H2 setup
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
| Value object | `Money`, `Address`, `ShippingMethod` |
| Domain event | `OrderPlaced`, `StockReduced`, `CartMerged` |
| Input Port | `ProductPort`, `CartPort`, `CheckoutPort`, `OrderPort` |
| Input Port impl | `ProductPortImpl`, `CartPortImpl` |
| Output Port | `ProductRepository`, `PaymentRepository` |
| External Port | `PaymentGatewayPort` |
| Resource (REST) | `ProductResource`, `CartResource`, `WebhookResource` |
| Persistence adapter | `ProductPersistenceAdapterImpl`, `OrderPersistenceAdapterImpl` |
| Gateway adapter | `StripeGatewayAdapter`, `PayPalGatewayAdapter` |
| JPA entity | `ProductJpaEntity`, `OrderJpaEntity`, `CartJpaEntity` |
| Panache repository | `ProductPanacheRepository`, `OrderPanacheRepository` |
| Request / Response DTOs | `ProductRequest`, `ProductResponse`, `PlaceOrderRequest` |
| MapStruct mappers | `ProductRestMapper`, `ProductPersistenceMapper` |

---

## Domain Model — Kotlin Data Classes

Domain entities and value objects are **plain Kotlin data classes** — zero framework annotations. They live in `domain/model/`.

```kotlin
// domain/model/Product.kt
data class Product(
    val id: UUID,
    val sku: String,
    val name: String,
    val description: String,
    val price: Money,
    val stockQuantity: Int,
    val categoryId: UUID,
    val imageUrls: List<String>,
    val status: ProductStatus,
    val createdAt: Instant,
    val updatedAt: Instant,
)

enum class ProductStatus { ACTIVE, DRAFT, ARCHIVED }

// domain/model/Money.kt  — value object; never use raw BigDecimal for price
data class Money(val amount: BigDecimal, val currency: String) {
    init { require(amount >= BigDecimal.ZERO) { "Amount must be non-negative" } }
    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Currency mismatch" }
        return copy(amount = amount + other.amount)
    }
}

// domain/model/Order.kt
data class Order(
    val id: UUID,
    val customerId: UUID,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val subtotal: Money,
    val discountAmount: Money,
    val shippingCost: Money,
    val total: Money,
    val shippingAddress: Address,
    val billingAddress: Address,
    val paymentId: UUID?,
    val placedAt: Instant,
    val updatedAt: Instant,
)

enum class OrderStatus { PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED }
```

---

## Application Ports — Kotlin Interfaces

```kotlin
// application/port/in/ProductPort.kt
interface ProductPort {
    fun create(product: Product): Product
    fun findById(id: UUID): Product
    fun findAll(page: Int, size: Int): List<Product>
    fun update(id: UUID, product: Product): Product
    fun archive(id: UUID)
}

// application/port/out/ProductRepository.kt
interface ProductRepository {
    fun save(product: Product): Product
    fun findById(id: UUID): Product?
    fun findAll(page: Int, size: Int): List<Product>
    fun existsBySku(sku: String): Boolean
    fun deleteById(id: UUID)
}

// application/port/out/PaymentGatewayPort.kt
interface PaymentGatewayPort {
    fun initiatePayment(payment: Payment): String        // returns gatewayReference
    fun processWebhook(payload: String, signature: String): PaymentEvent
}
```

---

## Application Services — Input Port Implementations

```kotlin
// application/service/ProductPortImpl.kt
@ApplicationScoped
class ProductPortImpl(
    private val productRepository: ProductRepository,
) : ProductPort {

    @Transactional
    override fun create(product: Product): Product {
        if (productRepository.existsBySku(product.sku))
            throw BusinessRuleException("SKU '${product.sku}' already exists")
        return productRepository.save(product)
    }

    override fun findById(id: UUID): Product =
        productRepository.findById(id)
            ?: throw ResourceNotFoundException("Product $id not found")

    override fun findAll(page: Int, size: Int): List<Product> =
        productRepository.findAll(page, size)

    @Transactional
    override fun update(id: UUID, product: Product): Product {
        findById(id)   // ensure exists
        return productRepository.save(product.copy(id = id))
    }

    @Transactional
    override fun archive(id: UUID) {
        val product = findById(id)
        productRepository.save(product.copy(status = ProductStatus.ARCHIVED))
    }
}
```

**Key rules:**
- `@ApplicationScoped` + constructor injection — never `@Inject` on fields.
- `@Transactional` on write operations only.
- Services never reference JPA, HTTP, or any infrastructure class.
- Throw custom exceptions (`ResourceNotFoundException`, `BusinessRuleException`) — never return `null` or swallow errors.

---

## REST Resources — Driving Adapters

```kotlin
// infrastructure/rest/catalog/ProductResource.kt — public read side
@Tag(name = "Catalog")
@Path("/api/products")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
class ProductResource(
    private val productPort: ProductPort,
    private val productMapper: ProductRestMapper,
) {

    @GET
    fun list(
        @QueryParam("page") @DefaultValue("0") page: Int,
        @QueryParam("size") @DefaultValue("20") size: Int,
        @QueryParam("q") q: String?,
    ): PageResponse<ProductResponse> =
        productPort.searchActive(q, page, size.coerceAtMost(100)).map(productMapper::toResponse)

    @GET
    @Path("/{id}")
    fun getById(@PathParam("id") id: UUID): ProductResponse =
        productMapper.toResponse(productPort.findActiveById(id))
}

// infrastructure/rest/catalog/AdminProductResource.kt — admin write side
@Tag(name = "Admin — Catalog")
@Path("/api/admin/products")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
class AdminProductResource(
    private val productPort: ProductPort,
    private val productMapper: ProductRestMapper,
) {

    @POST
    @RolesAllowed("ADMIN")
    fun create(@Valid request: ProductRequest): Response {
        val created = productPort.create(productMapper.toDomain(request))
        return Response.created(URI("/api/admin/products/${created.id}"))
            .entity(productMapper.toResponse(created))
            .build()
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed("ADMIN")
    fun update(@PathParam("id") id: UUID, @Valid request: ProductRequest): ProductResponse =
        productMapper.toResponse(productPort.update(id, productMapper.toDomain(request)))

    @DELETE
    @Path("/{id}")
    @RolesAllowed("ADMIN")
    fun archive(@PathParam("id") id: UUID): Response {
        productPort.archive(id)
        return Response.noContent().build()
    }
}
```

**Key rules:**
- Inject `ProductPort` interface — never `ProductPortImpl`.
- Resources are pure translators: receive HTTP → call port → map response. Zero business logic.
- Use `@Valid` on request bodies; validation failures are caught by the global exception mapper.
- Public reads and admin writes live in separate resources; paths, roles and the `PageResponse` shape come from `webstore-api-contract`.
- Role names match the JWT `role` claim exactly: `CUSTOMER`, `STAFF`, `MANAGER`, `ADMIN`.

---

## Persistence — Driven Adapters (Panache)

Details: [references/driven-adapters.md](references/driven-adapters.md). Read it when implementing persistence, MapStruct mappers, error handling, or OpenAPI config.

## REST Endpoints

Implement exactly the endpoints, access rules, DTOs, pagination shape and RFC 9457 error format in the `webstore-api-contract` skill. Do not keep a copy of the endpoint table here; load the contract section for the module you are working on.

Resource split (one package per module under `infrastructure/rest/`): `catalog` (`ProductResource`, `CategoryResource`, `ShippingMethodResource`, admin resources), `cart` (`CartResource`), `checkout` (`CheckoutResource`), `orders` (`OrderResource`, `AdminOrderResource`), `payments` (`PaymentResource`, `WebhookResource`), `inventory` (`AdminInventoryResource`), `customers` (`AuthResource`, `CustomerResource`, admin customer/coupon/report resources).

Cart resources must **not** carry `@RolesAllowed`. Annotate them `@PermitAll` and resolve the caller from the JWT when one is present, otherwise from the `sessionId` cookie. Use `@RolesAllowed("CUSTOMER")` for customer endpoints and `@RolesAllowed({"STAFF","MANAGER","ADMIN"})` or `@RolesAllowed("ADMIN")` for admin endpoints, as the contract specifies.

---

## `application.properties` Configuration

```properties
# ── Application ───────────────────────────────────────────────────────
quarkus.application.name=webstore-kotlin

# ── Server ────────────────────────────────────────────────────────────
quarkus.http.port=8080

# ── OpenAPI / Swagger ─────────────────────────────────────────────────
quarkus.smallrye-openapi.path=/q/openapi
quarkus.swagger-ui.path=/q/swagger-ui
quarkus.swagger-ui.always-include=true

# ── Flyway ────────────────────────────────────────────────────────────
quarkus.flyway.migrate-at-start=true
quarkus.flyway.locations=classpath:db/migration

# ── JWT ───────────────────────────────────────────────────────────────
mp.jwt.verify.publickey.location=META-INF/resources/publicKey.pem
mp.jwt.verify.issuer=https://auth.mycompany.com

# ── Prod datasource (PostgreSQL) ──────────────────────────────────────
%prod.quarkus.datasource.db-kind=postgresql
%prod.quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/webstore
%prod.quarkus.datasource.username=postgres
%prod.quarkus.datasource.password=

%prod.quarkus.hibernate-orm.database.generation=validate
%prod.quarkus.hibernate-orm.log.sql=false

# ── Dev datasource (H2 in-memory) ─────────────────────────────────────
%dev.quarkus.datasource.db-kind=h2
%dev.quarkus.datasource.jdbc.url=jdbc:h2:mem:webstoredb;DB_CLOSE_DELAY=-1
%dev.quarkus.datasource.username=sa
%dev.quarkus.datasource.password=

%dev.quarkus.hibernate-orm.database.generation=drop-and-create
%dev.quarkus.hibernate-orm.log.sql=true
%dev.quarkus.flyway.enabled=false

# ── Test datasource (H2) ──────────────────────────────────────────────
%test.quarkus.datasource.db-kind=h2
%test.quarkus.datasource.jdbc.url=jdbc:h2:mem:webstore_test;DB_CLOSE_DELAY=-1
%test.quarkus.datasource.username=sa
%test.quarkus.datasource.password=
%test.quarkus.hibernate-orm.database.generation=drop-and-create
%test.quarkus.flyway.enabled=false
```

> Dev: H2 console at `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:webstoredb`, user: `sa`, no password).
> Cart persistence in dev: use an in-memory `CartRepository` implementation bound to a `@IfBuildProfile("dev")` CDI alternative — avoids Redis dependency locally.

---

## Testing Strategy

Details: [references/testing.md](references/testing.md). Read it when writing tests.

## Key Webstore-Specific Rules

1. **Money**: always use the `Money` value object — never raw `BigDecimal` or `Double` for prices or totals.
2. **Order immutability**: after `OrderStatus.PENDING`, corrections go through compensating domain events — never mutate order items directly.
3. **Price freeze at checkout**: `OrderItem.unitPrice` is set from `CartItem.unitPrice` at the moment `CheckoutPort.placeOrder()` is called — it is never recalculated afterwards.
4. **Stock deduction**: deduct stock atomically inside `CheckoutPortImpl.placeOrder()` using optimistic locking (a `@Version var version: Long` column on `ProductJpaEntity`, matching `product.version`); retry once on `OptimisticLockException`, then return `409`.
5. **Payment idempotency**: every payment attempt generates a unique `idempotencyKey` (UUID); `PaymentPortImpl` checks for an existing payment with the same key before calling the gateway.
6. **Cart isolation**: anonymous carts are keyed by `sessionId` (TTL 30 min); authenticated carts by `customerId` (TTL 7 days). `CartPortImpl.merge()` handles the login merge.
7. **Webhook security**: `WebhookResource` validates the gateway signature before delegating to `PaymentPort.processWebhook()`; invalid signatures return `400` immediately.
8. **Admin endpoints**: all paths under `/api/admin/**` require `@RolesAllowed` with `STAFF`/`MANAGER`/`ADMIN` as the contract lists per endpoint; protect at the resource method level, not globally.
9. **Pagination**: all list endpoints accept `?page=0&size=20`; default page size is 20, max 100.
10. **No null leakage**: all repository output ports return `T?` (nullable); services convert `null` to `ResourceNotFoundException` before returning to the resource layer.

---

## Workflow — implementing or changing a module

1. **Scope.** Identify the module and its use cases from the module skill. If the request is ambiguous (which use cases? admin side too?), ask before coding.
2. **Domain.** Add or adjust entities and value objects in `domain/model/`, expressing invariants as methods. Write plain unit tests for every business rule in the module skill, with no Quarkus context.
3. **Ports.** Update the input port in `application/port/in/` and the output ports in `application/port/out/`.
4. **Service.** Implement `<Module>PortImpl` with the transaction boundary at the use-case level. Unit-test it against in-memory fakes of the output ports.
5. **Persistence adapter.** Add the Panache entity, repository, mapper and `<Entity>PersistenceAdapterImpl`. For any schema change, add a new Flyway migration; never edit an applied one.
6. **REST adapter.** Add the resource and DTOs exactly as in the `webstore-api-contract` section: same path, method, access rule, status codes and RFC 9457 errors. Add nothing the contract doesn't list.
7. **Tests.** Write API tests (`@QuarkusTest` + RestAssured) for each endpoint: the happy path plus every error status the contract documents for it. Use Testcontainers PostgreSQL for persistence tests.
8. **Verify.** Run `./gradlew build`, then open `/v3/api-docs` and compare the module's paths with the contract.

## Done criteria

A module is done only when all of these hold:

- [ ] `domain/` has no Quarkus, JPA or HTTP imports (`grep -rE "io\.quarkus|jakarta\.persistence|jakarta\.ws" <domain dir>` returns nothing).
- [ ] Every endpoint in the module's contract section exists with the documented path, method, access rule and status codes, and there are no extra endpoints.
- [ ] Every business rule in the module skill has at least one unit test that fails when the rule is broken.
- [ ] Errors are RFC 9457 Problem Details with the contract's status codes. No stack traces or entity internals leak.
- [ ] Module-specific checks pass:
  - **checkout:** order creation and stock deduction share one transaction, the optimistic-lock conflict retries once then returns `409`, and order-line prices are frozen.
  - **cart:** every endpoint works without a JWT via the `sessionId` cookie, and `POST /api/cart/merge` sums quantities capped at stock.
  - **orders:** every status change goes through the state machine, and cancellation restores stock.
  - **payments:** webhooks verify the signature before parsing and are idempotent on `gatewayReference`. No card data is stored or logged.
  - **inventory:** every stock change writes an audit-log row.
- [ ] `./gradlew build` is green with no new warnings, and there are no TODOs left in the changed code.

Architecture reminders: keep gateway-specific code behind `PaymentGatewayPort` in `infrastructure/gateway/`, follow `webstore-checkout` for the `placeOrder` transaction boundary, and apply the Key Webstore-Specific Rules above.
