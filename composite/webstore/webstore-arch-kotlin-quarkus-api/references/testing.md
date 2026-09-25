# webstore-arch-kotlin-quarkus-api — Testing strategy

Reference file for the `webstore-arch-kotlin-quarkus-api` skill. Read it when writing tests.

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
@TestSecurity(user = "admin", roles = ["ADMIN"])
class AdminProductResourceTest {

    @Test
    fun `should return 201 when product is created`() {
        given()
            .contentType(ContentType.JSON)
            .body("""{"sku":"SKU-001","name":"Widget","price":{"amount":9.99,"currency":"USD"}}""")
        .`when`()
            .post("/api/admin/products")
        .then()
            .statusCode(201)
            .header("Location", containsString("/api/admin/products/"))
    }
}
```

---
