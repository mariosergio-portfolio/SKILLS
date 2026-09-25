# tech-stack-java-spring-rest — Configuration files

Reference file for the `tech-stack-java-spring-rest` skill. Read it when writing application.yml / profile configuration.

## Configuration File Format

- Use **YAML format** only: `application.yml` (not `application.properties`).
- Place files at `src/main/resources/`.
- Split configuration across a **base file** plus **profile-specific overrides** — do not put datasource or JPA settings in the base file:
  - `application.yml` — shared settings (application name, default active profile, server port, Flyway locations, SpringDoc).
  - `application-prod.yml` — PostgreSQL production settings.
  - `application-dev.yml` — H2 in-memory settings (see H2 section below).


### `application.yml` (base — shared)

```yaml
spring:
  application:
    name: myapp-java
  profiles:
    active: prod          # override with --spring.profiles.active=dev for H2

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
  packages-to-scan: com.mycompany.myapp.infrastructure.rest
```

### `application-prod.yml` (PostgreSQL)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: postgres
    password:

  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    properties:
      hibernate:
        format_sql: true

  flyway:
    enabled: false        # enable once migrations are validated for production
```

### Profile activation

- Default profile is `prod` (set in base `application.yml`).
- Switch to H2 dev: `--spring.profiles.active=dev` or `SPRING_PROFILES_ACTIVE=dev`.

---


### `application-dev.yml` (profile override — H2)

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:mydb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
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

> Activate with `--spring.profiles.active=dev` or `SPRING_PROFILES_ACTIVE=dev` (overrides the default `prod` profile in base `application.yml`).  
> H2 console → `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:mydb`, user: `sa`, no password).


### 3. `H2ConsoleConfig.java`

Create `infrastructure/config/H2ConsoleConfig.java` — registers the H2 console servlet manually, active only on the `dev` profile:

```java
@Configuration
@Profile("dev")
public class H2ConsoleConfig {

    @Bean
    public ServletRegistrationBean<JakartaWebServlet> h2ConsoleServlet() {
        ServletRegistrationBean<JakartaWebServlet> registration =
                new ServletRegistrationBean<>(new JakartaWebServlet(), "/h2-console/*");
        registration.addInitParameter("webAllowOthers", "true");
        registration.addInitParameter("trace", "");
        return registration;
    }
}
```

### 4. `SecurityConfig.java`

Add `/h2-console/**` to the permit-list and disable `frameOptions` (H2 console uses iframes):

```java
.headers(headers -> headers
    .frameOptions(frame -> frame.disable())
)
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/h2-console/**").permitAll()
    ...
)
```

> See the full `SecurityConfig` in the **Swagger UI / OpenAPI** section — both Swagger and H2 paths are permitted together.



---
