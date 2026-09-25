---
name: tech-stack-kotlin-quarkus-rest
description: Kotlin 2.4 + Quarkus 3.38 REST API stack: pinned versions, Gradle Kotlin DSL build, Panache/JPA, MapStruct, OpenAPI, SmallRye JWT, and %dev/%test/%prod configuration with H2 and PostgreSQL. Use when creating or configuring a Quarkus service in Kotlin.
---

# Kotlin + Quarkus REST API

## Technology Stack

> **Version pins — last verified: (not recorded; write the YYYY-MM here when you check them).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | Kotlin 2.4.0 | JVM target 21; aligned with Quarkus BOM; use data classes, sealed classes, extension functions |
| Framework | Quarkus 3.38.0 | Latest stable (LTS: 3.33.3); CDI-based, GraalVM native-image ready |
| API | RESTEasy Reactive (Jakarta REST) | `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE` |
| Data Access | Hibernate ORM with Panache (Kotlin) | `PanacheRepository<E, ID>` or Active Record via `PanacheEntity` |
| Database | PostgreSQL (recommended) | Relational; use Flyway for migrations |
| Validation | Hibernate Validator (Jakarta Bean Validation) | `@Valid`, `@NotNull`, `@NotBlank`, etc. |
| Testing | JUnit 5 + Mockito-Kotlin + Testcontainers | Unit, integration, and API tests |
| Build | Gradle (Kotlin DSL) | `build.gradle.kts`; prefer Kotlin DSL over Groovy |
| Auth | Quarkus SmallRye JWT | Stateless authentication via `@RolesAllowed` |
| API Docs | SmallRye OpenAPI + Swagger UI | Auto-generated at `/q/swagger-ui` |

---

## Conventions & Patterns

### General
- Use **data classes** for immutable DTOs and value objects.
- Use **sealed classes/interfaces** for discriminated types and result wrappers.
- Prefer **constructor injection** via `@Inject`; avoid field injection where possible.
- Use `Optional<T>` or Kotlin nullable types (`T?`) for nullable returns; never return `null` from service methods unless the type is explicitly nullable.
- Avoid checked exceptions; throw custom unchecked exceptions (subclasses of `RuntimeException`).
- Use Kotlin coroutines (`suspend` functions) for non-blocking I/O only when using RESTEasy Reactive's `@RestSseElementType` or reactive pipelines; for standard CRUD use synchronous Panache.

### Naming (hexagonal / layered projects)
- Input Ports: `{Entity}Port` — one interface per aggregate/entity in `application/port/in/`
- Input Port implementations: `{Entity}PortImpl` in `application/service/`
- Output Ports: `{Entity}Repository` or `{Entity}Gateway` — interfaces in `application/port/out/`
- Driving adapters (resources): `{Entity}Resource` in `infrastructure/rest/`
- Driven adapters (persistence): `{Entity}PersistenceAdapterImpl` in `infrastructure/persistence/`
- JPA entities: `{Entity}JpaEntity` — never exposed outside the persistence adapter
- DTOs: `{Entity}Request` (input to resource), `{Entity}Response` (output from resource)
- MapStruct mappers: `{Entity}Mapper` — interfaces annotated with `@Mapper(componentModel = "cdi")`
- Domain entities: plain Kotlin class names (e.g. `Order`, `Customer`) — no framework annotations

### Domain / JPA Entities
- Domain entities live in `domain/model/` — **no framework annotations**; use plain Kotlin data classes or classes.
- JPA entities live in `infrastructure/persistence/` as `{Entity}JpaEntity` — annotated with `@Entity`, `@Table`.
- Use `UUID` as primary key type on JPA entities.
- Map relationships explicitly (`@OneToMany`, `@ManyToOne`) with `FetchType.LAZY` by default.
- Persistence adapters map between domain models and JPA entities using **MapStruct mappers**; domain models are never exposed to JPA directly.

### DTO Mapping (MapStruct 1.6.3)
- Declare one `@Mapper(componentModel = "cdi")` interface per entity pair needing conversion.
- Place mapper interfaces alongside the artefacts they map:
  - `infrastructure/rest/{module}/` — `{Entity}RestMapper` maps domain model ↔ Request/Response DTOs.
  - `infrastructure/persistence/adapter/` — `{Entity}PersistenceMapper` maps domain model ↔ `{Entity}JpaEntity`.
- Use `@Mapping` to handle field-name differences or type conversions; never write manual `copy()` + setter chains for mappings.
- MapStruct mappers are CDI beans (`componentModel = "cdi"`); inject them via constructor.
- **Dependency**: `org.mapstruct:mapstruct:1.6.3` + `org.mapstruct:mapstruct-processor:1.6.3` (in `kapt` configuration).
- ⚠️ MapStruct does not yet have official KSP support; `kapt` is still required. `kapt` is in maintenance mode but fully functional with Kotlin 2.4 on JVM.

### Service / Input Port Layer
- One Input Port interface per aggregate/entity; all operations for that entity are methods on the same interface.
- `{Entity}PortImpl` classes implement the corresponding Input Port interface and depend only on Output Port interfaces injected via constructor.
- Annotate `PortImpl` classes with `@ApplicationScoped`; use `@Transactional` at method level for write operations.
- `PortImpl` classes contain all business orchestration; they never reference JPA, HTTP, or any infrastructure concern.

### Exception Handling
- Define a global handler with `@Provider` implementing `ExceptionMapper<Throwable>`.
- Use custom exceptions: `ResourceNotFoundException`, `BusinessRuleException`, etc.
- Return structured error responses with `status`, `message`, and `timestamp`.

### Testing
- **Unit tests**: use Mockito-Kotlin to mock repositories; test service logic in isolation.
- **Integration tests**: use `@QuarkusTest` + Testcontainers for database tests.
- **API tests**: use `RestAssured` (bundled with `quarkus-junit5`) for resource-layer tests.

---

## Gradle Dependencies (Quarkus 3.38.0 + Kotlin 2.4.0)

Use the Quarkus BOM to manage all Quarkus extension versions. Only libraries outside the BOM need explicit versions.

> **LTS note**: Quarkus 3.33.x is the current LTS (valid until March 2027). For production stability, substitute `3.33.3` in place of `3.38.0` below and keep the same Kotlin version — both use Kotlin 2.4.0 in their BOM.

### `build.gradle.kts` — plugins

```kotlin
plugins {
    kotlin("jvm") version "2.4.0"
    kotlin("plugin.allopen") version "2.4.0"
    kotlin("kapt") version "2.4.0"   // maintenance mode, still required for MapStruct
    id("io.quarkus") version "3.38.0"
}
```

> `allopen` is required because Quarkus CDI proxies need open classes; the Quarkus plugin configures it automatically for `@ApplicationScoped`, `@Entity`, etc.

### `build.gradle.kts` — BOM import

```kotlin
val quarkusVersion = "3.38.0"
val mapstructVersion = "1.6.3"

dependencies {
    implementation(enforcedPlatform("io.quarkus.platform:quarkus-bom:$quarkusVersion"))
    // ... other dependencies below
}
```

### `build.gradle.kts` — dependencies

```kotlin
dependencies {
    implementation(enforcedPlatform("io.quarkus.platform:quarkus-bom:$quarkusVersion"))

    // ── Quarkus core extensions ──────────────────────────────────────
    implementation("io.quarkus:quarkus-kotlin")
    implementation("io.quarkus:quarkus-resteasy-reactive-jackson")
    implementation("io.quarkus:quarkus-hibernate-orm-panache-kotlin")
    implementation("io.quarkus:quarkus-hibernate-validator")
    implementation("io.quarkus:quarkus-flyway")
    implementation("io.quarkus:quarkus-smallrye-openapi")
    implementation("io.quarkus:quarkus-smallrye-jwt")
    implementation("io.quarkus:quarkus-smallrye-jwt-build")

    // ── Database ─────────────────────────────────────────────────────
    // PostgreSQL JDBC driver — version managed by Quarkus BOM
    implementation("io.quarkus:quarkus-jdbc-postgresql")

    // H2 — in-memory DB for local dev profile
    implementation("io.quarkus:quarkus-jdbc-h2")

    // ── MapStruct — NOT in Quarkus BOM, explicit version required ────
    implementation("org.mapstruct:mapstruct:$mapstructVersion")
    kapt("org.mapstruct:mapstruct-processor:$mapstructVersion")

    // ── Kotlin stdlib ────────────────────────────────────────────────
    implementation(kotlin("stdlib-jdk8"))

    // ── Testing ──────────────────────────────────────────────────────
    testImplementation("io.quarkus:quarkus-junit5")
    testImplementation("io.rest-assured:kotlin-extensions")
    testImplementation("io.quarkus:quarkus-test-security-jwt")
    testImplementation("io.quarkus:quarkus-jdbc-h2")                // H2 in test scope
    testImplementation("org.testcontainers:postgresql")               // version managed by Quarkus BOM
    testImplementation("org.mockito.kotlin:mockito-kotlin:6.3.0")
}
```

### `build.gradle.kts` — Kotlin / kapt options

```kotlin
kotlin {
    jvmToolchain(21)   // JDK 21 (minimum required by Quarkus 3.x)
}

kapt {
    correctErrorTypes = true
    arguments {
        arg("mapstruct.defaultComponentModel", "cdi")
    }
}

allOpen {
    annotation("jakarta.ws.rs.Path")
    annotation("jakarta.enterprise.context.ApplicationScoped")
    annotation("jakarta.enterprise.context.RequestScoped")
    annotation("io.quarkus.test.junit.QuarkusTest")
    annotation("jakarta.persistence.Entity")
}
```

### Version summary

| Library | Managed by Quarkus BOM? | Version |
|---------|-------------------------|---------|
| Quarkus extensions | ✅ | 3.38.0 (LTS: 3.33.3) |
| PostgreSQL driver | ✅ | (BOM) |
| H2 Database | ✅ | (BOM) |
| Flyway | ✅ | (BOM) |
| Hibernate Validator | ✅ | (BOM) |
| JUnit Jupiter | ✅ | (BOM) |
| RestAssured | ✅ | (BOM) |
| Testcontainers | ✅ | (BOM) |
| Kotlin stdlib | ✅ | 2.4.0 |
| MapStruct | ❌ | 1.6.3 |
| Mockito-Kotlin | ❌ | 6.3.0 |

---

## Swagger UI / OpenAPI

- Interactive API docs are available at `http://localhost:8080/q/swagger-ui` once the app is running.
- The raw OpenAPI JSON spec is at `http://localhost:8080/q/openapi`.

### 1. `OpenApiConfig.kt`

Create `infrastructure/config/OpenApiConfig.kt` to set the global API info via annotation:

```kotlin
@OpenAPIDefinition(
    info = Info(
        title = "My REST API",
        description = "REST API documentation",
        version = "1.0.0"
    )
)
@ApplicationScoped
class OpenApiConfig
```

### 2. SmallRye OpenAPI config in `application.properties`

```properties
quarkus.smallrye-openapi.path=/q/openapi
quarkus.swagger-ui.path=/q/swagger-ui
quarkus.swagger-ui.always-include=true
```

### 3. Resource `@Tag` annotation

Group endpoints in Swagger UI with `@Tag` on each `@Path` resource:

```kotlin
@Tag(name = "Orders")
@Path("/orders")
@ApplicationScoped
class OrderResource { ... }
```

---

## H2 In-Memory Database (dev profile)

Quarkus uses `%dev` profile-prefixed properties in `application.properties` — no separate file needed.

### `application.properties` — dev datasource

```properties
# ── Dev profile (H2 in-memory) ──────────────────────────────────────
%dev.quarkus.datasource.db-kind=h2
%dev.quarkus.datasource.jdbc.url=jdbc:h2:mem:mydb;DB_CLOSE_DELAY=-1
%dev.quarkus.datasource.username=sa
%dev.quarkus.datasource.password=

%dev.quarkus.hibernate-orm.database.generation=drop-and-create
%dev.quarkus.flyway.enabled=false
```

> H2 dev console is available at `http://localhost:8080/h2-console` when `quarkus.h2.jdbc.url` is an in-memory URL and Dev Services are active.

---

## Configuration File Format

- Use **`application.properties`** (Quarkus default); YAML (`application.yaml`) is also supported but properties is canonical for Quarkus.
- Profile-specific overrides use the `%{profile}.` prefix in the same file — no separate per-profile files needed.
- Place at `src/main/resources/`.

### `application.properties` (full example)

```properties
# ── Application ──────────────────────────────────────────────────────
quarkus.application.name=myapp-kotlin

# ── Server ───────────────────────────────────────────────────────────
quarkus.http.port=8080

# ── OpenAPI / Swagger ────────────────────────────────────────────────
quarkus.smallrye-openapi.path=/q/openapi
quarkus.swagger-ui.path=/q/swagger-ui
quarkus.swagger-ui.always-include=true

# ── Flyway (base) ────────────────────────────────────────────────────
quarkus.flyway.migrate-at-start=true
quarkus.flyway.locations=classpath:db/migration

# ── Prod datasource (PostgreSQL) ─────────────────────────────────────
%prod.quarkus.datasource.db-kind=postgresql
%prod.quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/mydb
%prod.quarkus.datasource.username=postgres
%prod.quarkus.datasource.password=

%prod.quarkus.hibernate-orm.database.generation=validate
%prod.quarkus.hibernate-orm.log.sql=true

# ── Dev datasource (H2) ──────────────────────────────────────────────
%dev.quarkus.datasource.db-kind=h2
%dev.quarkus.datasource.jdbc.url=jdbc:h2:mem:mydb;DB_CLOSE_DELAY=-1
%dev.quarkus.datasource.username=sa
%dev.quarkus.datasource.password=

%dev.quarkus.hibernate-orm.database.generation=drop-and-create
%dev.quarkus.hibernate-orm.log.sql=true
%dev.quarkus.flyway.enabled=false

# ── Test datasource (H2) ─────────────────────────────────────────────
%test.quarkus.datasource.db-kind=h2
%test.quarkus.datasource.jdbc.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1
%test.quarkus.datasource.username=sa
%test.quarkus.datasource.password=
%test.quarkus.hibernate-orm.database.generation=drop-and-create
%test.quarkus.flyway.enabled=false
```

### Profile activation

- Default active profile depends on the run mode: `dev` in `quarkus:dev`, `test` in tests, `prod` in `quarkus:run` / native binary.
- Override with: `./gradlew quarkusDev -Dquarkus.profile=staging`

---

## JWT / Security

Quarkus SmallRye JWT uses MicroProfile JWT — no custom filter needed:

```kotlin
// Protect an endpoint
@GET
@Path("/secure")
@RolesAllowed("user")
fun secureEndpoint(@Context securityContext: SecurityContext): Response { ... }
```

```properties
# Minimal JWT config
mp.jwt.verify.publickey.location=META-INF/resources/publicKey.pem
mp.jwt.verify.issuer=https://my-issuer.example.com
```

---

## How to use this skill
1. Apply these stack versions, Gradle setup, and Quarkus/Kotlin conventions for any Quarkus REST API project.
2. Use Quarkus **3.38.0** for the latest features or **3.33.3** (LTS) for production stability — both pin Kotlin **2.4.0** via the BOM.
