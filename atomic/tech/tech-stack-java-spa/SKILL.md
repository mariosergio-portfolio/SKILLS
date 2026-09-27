---
name: tech-stack-java-spa
description: Server-side Java single-page app stack: Java 25, Spring Boot and Vaadin 25 Flow, with Maven dependencies, Spring Security integration for views, and Karibu-Testing for UI tests, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or building a Vaadin web UI.
---

# Java 25 + Spring Boot + Vaadin SPA

## Technology Stack

> **Version pins — last verified: (not recorded; write the YYYY-MM here when you check them).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | Java 25+ | Use LTS releases; Java 25 is the latest LTS (Sept 2025) |
| Framework | Spring Boot 4.1.x | Auto-configuration, embedded server, production-ready |
| UI Framework | Vaadin 25 (Flow) | Server-side Java SPA; no separate front-end build |
| Component model | Vaadin Flow components | `Grid`, `FormLayout`, `TextField`, `ComboBox`, `Button`, etc. |
| Routing | Vaadin Router (`@Route`) | Annotation-driven navigation |
| State | Server-side session scope | Vaadin manages UI state server-side per session |
| Charts | Vaadin Charts add-on | Bar, pie, line, and cross-tabulation charts |
| Auth | Spring Security + Vaadin Spring Security integration | Role-based access; `@PermitAll`, `@RolesAllowed` on views |
| Testing | JUnit 5 + Karibu-Testing | Unit-test Vaadin views without a browser |

---

## Maven Dependencies

This skill covers the Vaadin-specific additions on top of the standard Spring Boot REST API stack (Spring Boot starters, PostgreSQL, Flyway, MapStruct, Lombok, JJWT, testing). The base `pom.xml` uses `spring-boot-starter-parent` **4.1.0** as the parent POM.

### Additional properties

```xml
<properties>
    <vaadin.version>25.2.0</vaadin.version>
</properties>
```

### `<dependencyManagement>` — Vaadin BOM

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.vaadin</groupId>
            <artifactId>vaadin-bom</artifactId>
            <version>${vaadin.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### `<dependencies>`

```xml
<!-- vaadin-core — open-source Flow components (Grid, FormLayout, TextField, …) -->
<dependency>
    <groupId>com.vaadin</groupId>
    <artifactId>vaadin-core</artifactId>
    <version>${vaadin.version}</version>
</dependency>

<!-- Spring Boot integration for Vaadin 25 — includes Vaadin Spring Security integration -->
<dependency>
    <groupId>com.vaadin</groupId>
    <artifactId>vaadin-spring-boot-starter</artifactId>
    <!-- version managed by Vaadin BOM -->
</dependency>

<!-- Vaadin Charts (commercial add-on) — bar, pie, line, cross-tab -->
<dependency>
    <groupId>com.vaadin</groupId>
    <artifactId>vaadin-charts-flow</artifactId>
    <!-- version managed by Vaadin BOM -->
</dependency>

<!-- Karibu-Testing — unit-test Vaadin views without a browser -->
<dependency>
    <groupId>com.github.mvysny.kaributesting</groupId>
    <artifactId>karibu-testing-v24</artifactId>
    <version>2.7.1</version>
    <scope>test</scope>
</dependency>
```

> `spring-boot-starter-security` must be declared in the base `pom.xml`. The Vaadin Spring Security integration is bundled inside `vaadin-spring-boot-starter` — no additional artifact required.

### Version summary

| Library | Managed by Vaadin BOM? | Version |
|---------|------------------------|---------|
| Vaadin Core | ✅ | 25.2.0 |
| Vaadin Spring Boot starter | ✅ | 25.2.0 |
| Vaadin Charts Flow | ✅ | 25.2.0 |
| Karibu-Testing v24 | ❌ | 2.7.1 |

---

## Security Configuration

Annotate views with `@PermitAll` (authenticated users) or `@RolesAllowed("ROLE_X")`. Configure Spring Security in `infrastructure/config/` to allow Vaadin static resources and the Vaadin endpoint. Unauthenticated users are redirected to the login view automatically by the Vaadin Spring Security integration.

---

## `application.yml` — Vaadin properties

Add these Vaadin-specific properties on top of the base `application.yml` (Spring Boot app name, server port, Flyway, SpringDoc):

```yaml
vaadin:
  launch-browser: false
  allowed-packages: com.mycompany.<app>
```

---

## Conventions

- Views are **`@Component` classes** annotated with `@Route`; never instantiated manually.
- Constructor injection only — views receive Input Port interfaces, never concrete implementations.
- Use `UI.getCurrent().access(...)` for background-thread UI updates.
- Use `collectAsStateWithLifecycle` is not applicable — Vaadin manages lifecycle server-side.

### View naming
- `{Entity}ListView`, `{Entity}FormView`, `{Feature}View` — in `infrastructure/spa/{module}/`
- `MainLayout` (implements `RouterLayout`) — in `infrastructure/spa/shared/`
- Reusable components: `{Feature}Component` or `{Feature}Panel` — in `infrastructure/spa/shared/`

### Routing
- `@Route(value = "path", layout = MainLayout.class)` on every view.
- `@PageTitle("…")` for the browser tab title.
- `RouteParameters` or `@QueryParameters` for passing entity IDs between views.

### Data binding
- `Binder<T>` for form binding to ViewModel records — never bind directly to domain entities.
- Validate with `Binder` validators; supplement with Jakarta Bean Validation on ViewModel records.
- MapStruct `{Entity}SpaMapper` for domain model ↔ ViewModel mapping (use `@Mapper(componentModel = "spring")` with MapStruct 1.6.3).

### Grid & lists
- `Grid<T>` with lazy loading (`DataProvider.fromCallbacks`) for large datasets.
- Provide column headers and renderers explicitly; no reflection-based auto-column generation.

### Charts
- `Chart` component (Vaadin Charts) for bar, pie, donut, multi-line, and cross-tabulation visualisations.
- Map data to `DataSeries` / `ListSeries`; no API calls inside chart components.

### Exception handling
- `HasErrorParameter<NotFoundException>` on a dedicated `ErrorView`.
- `Notification` toasts for validation and business rule errors.

---

## Testing

- **Unit tests**: Karibu-Testing — instantiate views with mocked Input Port interfaces (Mockito); assert component state, grid content, and navigation.
- **Integration tests**: `@SpringBootTest` + Karibu-Testing with real Spring context and Testcontainers database.
- **E2E tests**: Playwright or Selenium against a running instance for critical user flows.

---

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table (and its reference files). Don't pull "latest" from memory or from a generator, and if a generator writes different versions, change them to the table's.
- Scaffold the skeleton only: build files, layout, configuration, a health check, and one smoke test. Add no example domain code, sample entities or database migrations unless asked.
- If a required tool is missing (JDK, Maven, Gradle, .NET SDK, Node, Android SDK), say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

This stack builds on `tech-stack-java-spring-rest`. Run that skill's New project workflow first, then apply the Vaadin additions below.

**Inputs:** the same as `tech-stack-java-spring-rest` (name, package, Maven), plus whether Vaadin Charts is needed. Charts is a commercial add-on, so don't add it unless asked.

1. **Base.** Follow steps 1–7 of the Spring REST workflow, but skip the REST-only parts: no Swagger UI unless the app also exposes an API.
2. **Vaadin.** Add the Vaadin properties, the BOM in `<dependencyManagement>` and the dependencies from the Maven Dependencies section. Add the production build profile Vaadin needs for `./mvnw -Pproduction package`.
3. **Security.** Replace the REST `SecurityConfig` with the Vaadin-aware one from the Security Configuration section, including a `LoginView` and the actuator health endpoint left public.
4. **UI shell.** A `MainLayout` (`AppLayout`) and one `@Route("")` placeholder view marked `@PermitAll`, following the View naming and Routing conventions.
5. **Configuration.** Add the Vaadin properties to `application.yml` as in the `application.yml` section.
6. **Tests.** A Karibu-Testing test that navigates to the placeholder view and finds its heading, plus the Spring context/health smoke test.
7. **Verify.** Run `./mvnw verify`, then start the app and check that `curl -s localhost:8080/actuator/health` returns `UP` and that `/` returns `200` (or redirects to the login page). Stop it.

## Done criteria (new project)

- [ ] `./mvnw verify` is green, and the Karibu test and smoke test ran.
- [ ] The app starts, health is `UP`, and the root route renders or redirects to login.
- [ ] Vaadin and Spring versions match the tables in this skill and `tech-stack-java-spring-rest`.
- [ ] The production profile is configured. Charts is included only if it was asked for.
