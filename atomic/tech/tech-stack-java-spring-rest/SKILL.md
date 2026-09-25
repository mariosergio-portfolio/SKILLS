---
name: tech-stack-java-spring-rest
description: Use when the user invokes /tech-stack-java-spring-rest or asks about building a Java 25 Spring Boot REST API — technology stack, Maven dependencies, configuration, OpenAPI/Swagger, H2 dev setup, MapStruct, JPA conventions, and Spring patterns.
---

# Java 25 + Spring Boot REST API

## When to use this skill
Activate when the user types `/tech-stack-java-spring-rest` or needs general guidance for a Java 25 Spring Boot REST API — stack versions, Maven setup, configuration, OpenAPI, H2 dev profile, MapStruct, JPA, and Spring conventions.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | Java 25+ | Use LTS releases; Java 25 is the latest LTS (Sept 2025) |
| Framework | Spring Boot 4.1.x | Auto-configuration, embedded server, production-ready |
| API | Spring MVC (REST) | `@RestController`, `@RequestMapping` |
| Data Access | Spring Data JPA + Hibernate | Repository pattern via `JpaRepository` |
| Database | PostgreSQL (recommended) | Relational; use Flyway for migrations |
| Validation | Jakarta Bean Validation | `@Valid`, `@NotNull`, `@NotBlank`, etc. |
| Testing | JUnit 5 + Mockito + Testcontainers | Unit, integration, and API tests |
| Build | Maven or Gradle | Prefer Maven for enterprise; Gradle for flexibility |
| Auth | Spring Security + JWT | Stateless authentication |
| API Docs | SpringDoc OpenAPI (Swagger UI) | Auto-generated interactive API docs at `/swagger-ui.html` |

---

## Conventions & Patterns

### General
- Use **Java records** for immutable DTOs and value objects.
- Use **sealed interfaces/classes** for discriminated types.
- Prefer **constructor injection** over field injection (`@Autowired` on fields is discouraged).
- Use `Optional<T>` for nullable return values in repositories and services; never return `null`.
- Avoid checked exceptions in service layer; throw custom unchecked exceptions (`RuntimeException` subclasses).

### Naming (hexagonal / layered projects)
- Input Ports: `{Entity}Port` — one interface per aggregate/entity in `application/port/in/`
- Input Port implementations: `{Entity}PortImpl` in `application/service/`
- Output Ports: `{Entity}Repository` or `{Entity}Gateway` — interfaces in `application/port/out/`
- Driving adapters (controllers): `{Entity}Controller` in `infrastructure/rest/`
- Driven adapters (persistence): `{Entity}PersistenceAdapterImpl` in `infrastructure/persistence/`
- JPA entities: `{Entity}JpaEntity` — never exposed outside the persistence adapter
- DTOs: `{Entity}Request` (input to controller), `{Entity}Response` (output from controller)
- MapStruct mappers: `{Entity}Mapper` — interfaces annotated with `@Mapper(componentModel = "spring")`
- Domain entities: plain class names (e.g. `Order`, `Customer`) — no framework annotations

### Domain / JPA Entities
- Domain entities live in `domain/model/` — **no framework annotations**; prefer plain Java records or classes.
- JPA entities live in `infrastructure/persistence/` as `{Entity}JpaEntity` — annotated with `@Entity`, `@Table`.
- Use `UUID` as primary key type on JPA entities.
- Map relationships explicitly (`@OneToMany`, `@ManyToOne`) with `FetchType.LAZY` by default.
- Persistence adapters map between domain models and JPA entities using **MapStruct mappers**; domain models are never exposed to JPA directly.

### DTO Mapping (MapStruct 1.6.3)
- Declare one `@Mapper(componentModel = "spring")` interface per entity pair needing conversion.
- Place mapper interfaces alongside the artefacts they map:
  - `infrastructure/rest/{module}/` — `{Entity}RestMapper` maps domain model ↔ Request/Response DTOs.
  - `infrastructure/persistence/adapter/` — `{Entity}PersistenceMapper` maps domain model ↔ `{Entity}JpaEntity`.
- Use `@Mapping` to handle field-name differences or type conversions; never write manual `new` + setter chains for mappings.
- MapStruct mappers are Spring beans (`componentModel = "spring"`); inject them via constructor.
- For Maven: add the `mapstruct` dependency and the `maven-compiler-plugin` `annotationProcessorPaths` entry. For Gradle: use `annotationProcessor` configuration.
- **Dependency**: `org.mapstruct:mapstruct:1.6.3` + `org.mapstruct:mapstruct-processor:1.6.3`.

### Service / Input Port Layer
- One Input Port interface per aggregate/entity; all operations for that entity are methods on the same interface.
- `{Entity}PortImpl` classes implement the corresponding Input Port interface and depend only on Output Port interfaces injected via constructor.
- Annotate `PortImpl` classes with `@Service`; use `@Transactional` at method level for write operations.
- `PortImpl` classes contain all business orchestration; they never reference JPA, HTTP, or any infrastructure concern.

### Exception Handling
- Define a global handler with `@RestControllerAdvice`.
- Use custom exceptions: `ResourceNotFoundException`, `BusinessRuleException`, etc.
- Return structured error responses with `status`, `message`, and `timestamp`.

### Testing
- **Unit tests**: use Mockito to mock repositories; test service logic in isolation.
- **Integration tests**: use `@SpringBootTest` + Testcontainers for database tests.
- **API tests**: use `MockMvc` or `WebTestClient` for controller-layer tests.

---

## Maven Dependencies (Spring Boot 4.1.x + Java 25)

Details: [references/maven-dependencies.md](references/maven-dependencies.md). Read it when creating or editing pom.xml.

## Swagger UI / OpenAPI

- Interactive API docs are available at `http://localhost:8080/swagger-ui/index.html` once the app is running.
- The raw OpenAPI JSON spec is at `http://localhost:8080/v3/api-docs`.

### 1. `OpenApiConfig.java`

Create `infrastructure/config/OpenApiConfig.java` to set the global API title:

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI appOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("My REST API")
                        .description("REST API documentation")
                        .version("1.0.0"));
    }
}
```

### 2. `SecurityConfig.java`

Add Swagger and H2 console paths to the permit-list. Disable `frameOptions` so the H2 console iframe loads correctly:

```java
http
    .csrf(csrf -> csrf.disable())
    .headers(headers -> headers
        .frameOptions(frame -> frame.disable())
        .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
    )
    .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .authorizeHttpRequests(auth -> auth
        .requestMatchers(
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/h2-console/**",
            "/favicon.ico"
        ).permitAll()
        .anyRequest().permitAll()
    );
```

### 3. SpringDoc config in base `application.yml`

SpringDoc settings live in the shared base `application.yml` (see **Configuration File Format** below), not in profile-specific files:

```yaml
springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    tags-sorter: alpha
    operations-sorter: alpha
  packages-to-scan: com.mycompany.myapp.infrastructure.rest
```

### 4. Controller `@Tag` annotation

Group endpoints in Swagger UI with `@Tag` on each `@RestController`:

```java
@Tag(name = "Orders")
@RestController
@RequestMapping("/orders")
public class OrderController { ... }
```

---


### H2 In-Memory Database (dev profile)

Spring Boot 4.x no longer auto-registers the H2 console servlet. It must be registered manually. Follow all four steps below.

### 1. `pom.xml` — H2 dependency

H2 must **not** use `<scope>runtime</scope>` — it needs to be available at compile time so `H2ConsoleConfig` can reference `JakartaWebServlet`:

```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
</dependency>
```

---


## Configuration File Format

Details: [references/configuration.md](references/configuration.md). Read it when writing application.yml / profile configuration.

## How to use this skill
1. Apply these stack versions, Maven setup, and Spring conventions for any Java 25 REST API project.
2. Respond and assist in English unless the user requests another language.
