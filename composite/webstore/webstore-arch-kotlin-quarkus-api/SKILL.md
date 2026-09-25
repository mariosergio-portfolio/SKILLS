---
name: webstore-arch-kotlin-quarkus-api
description: Use when the user invokes %webstore-arch-kotlin-quarkus-api or asks about implementing the web store back-end in Kotlin + Quarkus — project structure, domain entities, port/adapter naming, REST endpoints, and configuration for the e-commerce REST API using Hexagonal Architecture.
---

# Web Store — Kotlin + Quarkus API Implementation

## When to use this skill
Activate when the user types `%webstore-arch-kotlin-quarkus-api` or asks about implementing the web store back-end in Kotlin + Quarkus.

**Always load these foundation skills first:**
- `%tech-arch-hexagonal` — hexagonal architecture, three rings, ports, adapters, dependency rules, folder layout
- `%tech-good-practices` — SOLID principles, clean code, API design, testing strategy
- `%tech-stack-kotlin-quarkus-rest` — Kotlin 2.4 + Quarkus 3.38 stack, Gradle, OpenAPI, H2, MapStruct

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

- **Artifact name:** `webstore-kotlin-api`
- **Package prefix:** `com.mycompany.webstore`
- **Language:** Kotlin 2.4.0 (JVM 21)
- **Framework:** Quarkus 3.38.0 (LTS: 3.33.3)
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
│   │   ├── inventory/                ← InventoryResource + DTOs + mappers
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
// infrastructure/rest/catalog/ProductResource.kt
@Tag(name = "Catalog")
@Path("/api/products")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
class ProductResource(
    private val productPort: ProductPort,
    private val productMapper: ProductRestMapper,
) {

    @GET
    fun list(
        @QueryParam("page") @DefaultValue("0") page: Int,
        @QueryParam("size") @DefaultValue("20") size: Int,
    ): List<ProductResponse> =
        productPort.findAll(page, size).map(productMapper::toResponse)

    @GET
    @Path("/{id}")
    fun getById(@PathParam("id") id: UUID): ProductResponse =
        productMapper.toResponse(productPort.findById(id))

    @POST
    @RolesAllowed("admin")
    fun create(@Valid request: ProductRequest): Response {
        val created = productPort.create(productMapper.toDomain(request))
        return Response.created(URI("/api/products/${created.id}"))
            .entity(productMapper.toResponse(created))
            .build()
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed("admin")
    fun update(@PathParam("id") id: UUID, @Valid request: ProductRequest): ProductResponse =
        productMapper.toResponse(productPort.update(id, productMapper.toDomain(request)))

    @DELETE
    @Path("/{id}")
    @RolesAllowed("admin")
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
- `@RolesAllowed` on write endpoints; public `GET` endpoints require no annotation.

---

## Persistence — Driven Adapters (Panache)

```kotlin
// infrastructure/persistence/entity/ProductJpaEntity.kt
@Entity
@Table(name = "products")
class ProductJpaEntity {
    @Id
    var id: UUID = UUID.randomUUID()

    @Column(unique = true, nullable = false)
    var sku: String = ""

    var name: String = ""
    var description: String = ""

    @Column(name = "price_amount", nullable = false, precision = 19, scale = 4)
    var priceAmount: BigDecimal = BigDecimal.ZERO

    @Column(name = "price_currency", nullable = false, length = 3)
    var priceCurrency: String = "USD"

    @Column(name = "stock_quantity", nullable = false)
    var stockQuantity: Int = 0

    @Column(name = "category_id", nullable = false)
    var categoryId: UUID = UUID.randomUUID()

    @Enumerated(EnumType.STRING)
    var status: ProductStatus = ProductStatus.DRAFT

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}

// infrastructure/persistence/repository/ProductPanacheRepository.kt
@ApplicationScoped
class ProductPanacheRepository : PanacheRepositoryBase<ProductJpaEntity, UUID>

// infrastructure/persistence/adapter/ProductPersistenceAdapterImpl.kt
@ApplicationScoped
class ProductPersistenceAdapterImpl(
    private val repo: ProductPanacheRepository,
    private val mapper: ProductPersistenceMapper,
) : ProductRepository {

    override fun save(product: Product): Product =
        mapper.toDomain(repo.getEntityManager().merge(mapper.toJpa(product)))

    override fun findById(id: UUID): Product? =
        repo.findById(id)?.let(mapper::toDomain)

    override fun findAll(page: Int, size: Int): List<Product> =
        repo.findAll().page(page, size).list().map(mapper::toDomain)

    override fun existsBySku(sku: String): Boolean =
        repo.count("sku", sku) > 0

    override fun deleteById(id: UUID) =
        repo.deleteById(id)
}
```

**Key rules:**
- Use `PanacheRepositoryBase<E, ID>` (Repository pattern) — not Active Record (`PanacheEntity`), to keep the domain model clean.
- JPA entities (`*JpaEntity`) are internal to the persistence package — never leak them to the application or domain.
- Map via `ProductPersistenceMapper` (MapStruct); never pass JPA entities to the service layer.
- Use optimistic locking (`@Version`) on `OrderJpaEntity` and `ProductJpaEntity` (stock field) to prevent lost-update races.

---

## MapStruct Mappers

```kotlin
// infrastructure/rest/catalog/ProductRestMapper.kt
@Mapper(componentModel = "cdi")
interface ProductRestMapper {
    fun toResponse(product: Product): ProductResponse
    fun toDomain(request: ProductRequest): Product
}

// infrastructure/persistence/adapter/ProductPersistenceMapper.kt
@Mapper(componentModel = "cdi")
interface ProductPersistenceMapper {
    @Mapping(source = "price.amount", target = "priceAmount")
    @Mapping(source = "price.currency", target = "priceCurrency")
    fun toJpa(product: Product): ProductJpaEntity

    @Mapping(source = "priceAmount", target = "price.amount")
    @Mapping(source = "priceCurrency", target = "price.currency")
    fun toDomain(entity: ProductJpaEntity): Product
}
```

---

## Global Exception Mapper

```kotlin
// infrastructure/config/GlobalExceptionMapper.kt
@Provider
class GlobalExceptionMapper : ExceptionMapper<Exception> {

    override fun toResponse(exception: Exception): Response {
        val (status, message) = when (exception) {
            is ResourceNotFoundException         -> 404 to exception.message
            is BusinessRuleException             -> 422 to exception.message
            is InsufficientStockException        -> 422 to exception.message
            is InvalidStatusTransitionException  -> 422 to exception.message
            is ConstraintViolationException      -> 400 to exception.message
            else                                 -> 500 to "Internal server error"
        }
        val body = mapOf(
            "status"    to status,
            "message"   to message,
            "timestamp" to Instant.now().toString(),
        )
        return Response.status(status).entity(body).type(MediaType.APPLICATION_JSON).build()
    }
}
```

---

## OpenAPI Config

```kotlin
// infrastructure/config/OpenApiConfig.kt
@OpenAPIDefinition(
    info = Info(
        title = "Web Store API",
        description = "REST API for the Web Store e-commerce system",
        version = "1.0.0"
    )
)
@ApplicationScoped
class OpenApiConfig
```

Add `@Tag(name = "Catalog")`, `@Tag(name = "Cart")`, `@Tag(name = "Orders")`, etc. to each `@Path` resource class.

---

## REST Endpoint Summary

| Method | Path | Module | Auth |
|---|---|---|---|
| `GET` / `POST` | `/api/products` | Catalog | public / admin |
| `GET` / `PUT` / `DELETE` | `/api/products/{id}` | Catalog | public / admin |
| `GET` / `POST` | `/api/categories` | Catalog | public / admin |
| `GET` / `PUT` / `DELETE` | `/api/categories/{id}` | Catalog | public / admin |
| `GET` | `/api/cart` | Cart | user |
| `POST` | `/api/cart/items` | Cart | user |
| `PATCH` / `DELETE` | `/api/cart/items/{itemId}` | Cart | user |
| `POST` / `DELETE` | `/api/cart/coupon` | Cart | user |
| `POST` | `/api/cart/refresh` | Cart | user |
| `POST` | `/api/orders` | Checkout | user |
| `GET` | `/api/orders` | Orders | user |
| `GET` / `DELETE` | `/api/orders/{id}` | Orders | user |
| `GET` | `/api/admin/orders` | Orders | admin |
| `PATCH` | `/api/admin/orders/{id}/status` | Orders | admin |
| `POST` | `/api/payments` | Payments | user |
| `GET` | `/api/payments/{orderId}` | Payments | user |
| `POST` | `/api/payments/webhook/stripe` | Payments | public |
| `POST` | `/api/payments/webhook/paypal` | Payments | public |
| `POST` | `/api/payments/webhook/mercadopago` | Payments | public |
| `GET` / `PATCH` | `/api/inventory/{productId}` | Inventory | admin |
| `GET` | `/api/inventory` | Inventory | admin |

Use `?page=0&size=20&sort=name,asc` for pagination. Errors: RFC 9457 Problem Details via `GlobalExceptionMapper`.

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

### Unit tests — Application services
```kotlin
// Test ProductPortImpl in isolation — mock all output ports
@ExtendWith(MockitoExtension::class)
class ProductPortImplTest {

    @Mock lateinit var productRepository: ProductRepository
    @InjectMocks lateinit var productPort: ProductPortImpl

    @Test
    fun `should throw BusinessRuleException when SKU already exists`() {
        // Arrange
        whenever(productRepository.existsBySku("SKU-001")).thenReturn(true)
        val product = aProduct(sku = "SKU-001")

        // Act / Assert
        assertThrows<BusinessRuleException> { productPort.create(product) }
    }
}
```

### Integration tests — Persistence adapters
```kotlin
@QuarkusTest
@TestProfile(H2TestProfile::class)
class ProductPersistenceAdapterImplTest {
    @Inject lateinit var adapter: ProductRepository

    @Test
    fun `should persist and retrieve product by id`() {
        val saved = adapter.save(aProduct())
        val found = adapter.findById(saved.id)
        assertNotNull(found)
        assertEquals(saved.sku, found!!.sku)
    }
}
```

### API tests — REST resources
```kotlin
@QuarkusTest
@TestSecurity(user = "admin", roles = ["admin"])
class ProductResourceTest {

    @Test
    fun `should return 201 when product is created`() {
        given()
            .contentType(ContentType.JSON)
            .body("""{"sku":"SKU-001","name":"Widget","price":{"amount":9.99,"currency":"USD"}}""")
        .`when`()
            .post("/api/products")
        .then()
            .statusCode(201)
            .header("Location", containsString("/api/products/"))
    }
}
```

---

## Key Webstore-Specific Rules

1. **Money**: always use the `Money` value object — never raw `BigDecimal` or `Double` for prices or totals.
2. **Order immutability**: after `OrderStatus.PENDING`, corrections go through compensating domain events — never mutate order items directly.
3. **Price freeze at checkout**: `OrderItem.unitPrice` is set from `CartItem.unitPrice` at the moment `CheckoutPort.placeOrder()` is called — it is never recalculated afterwards.
4. **Stock deduction**: deduct stock atomically inside `CheckoutPortImpl.placeOrder()` using optimistic locking (`@Version` on `ProductJpaEntity.stockQuantity`); retry once on `OptimisticLockException`.
5. **Payment idempotency**: every payment attempt generates a unique `idempotencyKey` (UUID); `PaymentPortImpl` checks for an existing payment with the same key before calling the gateway.
6. **Cart isolation**: anonymous carts are keyed by `sessionId` (TTL 30 min); authenticated carts by `customerId` (TTL 7 days). `CartPortImpl.merge()` handles the login merge.
7. **Webhook security**: `WebhookResource` validates the gateway signature before delegating to `PaymentPort.processWebhook()`; invalid signatures return `400` immediately.
8. **Admin endpoints**: all paths under `/api/admin/**` require `@RolesAllowed("admin")`; protect at the resource method level, not globally.
9. **Pagination**: all list endpoints accept `?page=0&size=20`; default page size is 20, max 100.
10. **No null leakage**: all repository output ports return `T?` (nullable); services convert `null` to `ResourceNotFoundException` before returning to the resource layer.

---

## How to use this skill
1. Load `%tech-arch-hexagonal`, `%tech-good-practices`, and `%tech-stack-kotlin-quarkus-rest` for the full technical foundation.
2. Load the relevant web store domain skills for the module being implemented.
3. Apply the project structure and naming conventions defined here to all web store Kotlin + Quarkus implementation work.
4. Use `PaymentGatewayPort` to keep gateway-specific code isolated in `infrastructure/gateway/`.
5. Refer to `%webstore-data-structure` for the relational schema, DDL, and migration reference.
6. Refer to `%webstore-inventory` for optimistic locking patterns on stock deduction.
7. Use `%webstore-checkout` for the `placeOrder` transaction boundaries.
8. Respond and assist in English unless the user requests another language.
9. Await further instructions from the user and execute them accordingly.
