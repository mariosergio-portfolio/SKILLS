# webstore-arch-kotlin-quarkus-api — Driven adapters, mappers, exception mapper and OpenAPI

Reference file for the `webstore-arch-kotlin-quarkus-api` skill. Read it when implementing persistence, MapStruct mappers, error handling, or OpenAPI config.

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
- Use optimistic locking (`@Version` mapped to the `product.version` column) on `ProductJpaEntity` to prevent lost updates on stock. Orders have no version column: status changes are serialised by the state machine inside one transaction.

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
