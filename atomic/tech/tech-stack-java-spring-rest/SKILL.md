---
name: tech-stack-java-spring-rest
description: Java 25 + Spring Boot 4.1 REST API stack: pinned versions, Maven dependencies, JPA and MapStruct conventions, OpenAPI/Swagger, H2 console for dev, profile-based configuration, and security baseline, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or creating or configuring a Spring Boot REST service.
---

# Java 25 + Spring Boot REST API

## Technology Stack

> **Version pins — last verified: (not recorded; write the YYYY-MM here when you check them).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

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

---

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table (and its reference files). Don't pull "latest" from memory or from a generator, and if a generator writes different versions, change them to the table's.
- Scaffold the skeleton only: build files, layout, configuration, a health check, and one smoke test. Add no example domain code, sample entities or database migrations unless asked.
- If a required tool is missing (JDK, Maven, Gradle, .NET SDK, Node, Android SDK), say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

**Inputs:** service name (e.g. `billing`) · group/package (default `com.mycompany.<name>`) · build tool (default **Maven**).

1. **Build.** Write `pom.xml` with the Spring Boot parent and the dependencies in [references/maven-dependencies.md](references/maven-dependencies.md), and add `spring-boot-starter-actuator` for health. Generate the Maven wrapper (`mvn -N wrapper:wrapper`) so `./mvnw` works without a global Maven.
2. **Layout.** Create `src/main/java/<package>/` with the hexagonal folders from `tech-arch-hexagonal` (`domain/`, `application/port/in|out/`, `application/service/`, `infrastructure/rest|persistence|config/`). Add a `package-info.java` or `.gitkeep` so empty folders survive git.
3. **Entry point.** `<Name>Application.java` with `@SpringBootApplication`.
4. **Configuration.** Add `application.yml` + `application-dev.yml` (H2) + `application-prod.yml` (PostgreSQL via env vars) as in [references/configuration.md](references/configuration.md). Expose only `health` and `info` actuator endpoints.
5. **Cross-cutting.** Add `OpenApiConfig`, and a `SecurityConfig` that permits `/actuator/health`, Swagger UI and `/v3/api-docs`. Add a global exception handler returning RFC 9457 `ProblemDetail`.
6. **Smoke test.** A `@SpringBootTest` that starts the context and asserts `GET /actuator/health` returns `UP`.
7. **Repo files.** `.gitignore` (target/, IDE files, `.env`), and a `README.md` with how to build, run with the dev profile, and open Swagger UI.
8. **Verify.** Run `./mvnw verify`. Then start the app with `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`, check the health endpoint and Swagger UI with `curl -s localhost:8080/actuator/health` and `curl -s -o /dev/null -w "%{http_code}" localhost:8080/swagger-ui/index.html`, then stop the app.

## Done criteria (new project)

- [ ] `./mvnw verify` is green, and the smoke test ran.
- [ ] The app starts on the dev profile, `/actuator/health` returns `{"status":"UP"}`, and Swagger UI returns `200`.
- [ ] Java, Spring Boot and library versions match this skill's table.
- [ ] The hexagonal folders exist, with no example domain code.
- [ ] No secrets in the repo: prod credentials come from environment variables.
- [ ] `README.md` explains build and run. Anything not verified is listed explicitly in your reply.
