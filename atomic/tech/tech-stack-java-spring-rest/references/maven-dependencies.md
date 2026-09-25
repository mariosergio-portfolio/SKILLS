# tech-stack-java-spring-rest — Maven dependencies

Reference file for the `tech-stack-java-spring-rest` skill. Read it when creating or editing pom.xml.

## Maven Dependencies (Spring Boot 4.1.x + Java 25)

Use `spring-boot-starter-parent` **4.1.0** as the parent POM. All Spring Boot–managed versions are inherited automatically; only libraries not in the Spring Boot BOM need an explicit `<version>`.

### `pom.xml` — properties

```xml
<properties>
    <java.version>25</java.version>
    <mapstruct.version>1.6.3</mapstruct.version>
    <jjwt.version>0.13.0</jjwt.version>
    <springdoc.version>2.8.9</springdoc.version>
</properties>
```

### `pom.xml` — parent

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.0</version>
    <relativePath/>
</parent>
```

### `pom.xml` — dependencies

```xml
<dependencies>

    <!-- ── Spring Boot starters ───────────────────────────────────── -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <!-- ── Database ───────────────────────────────────────────────── -->
    <!-- PostgreSQL JDBC driver — version 42.7.11 managed by Boot BOM -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- H2 — in-memory DB for local dev profile; version managed by Boot BOM -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <!-- <scope>runtime</scope> -->
    </dependency>

    <!-- Flyway — version 12.4.0 managed by Boot BOM -->
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
    </dependency>

    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-database-postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- ── MapStruct — NOT in Boot BOM, explicit version required ─── -->
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct</artifactId>
        <version>${mapstruct.version}</version>
    </dependency>

    <!-- ── Lombok — version 1.18.46 managed by Boot BOM ────────────── -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <scope>provided</scope>
    </dependency>

    <!-- ── SpringDoc OpenAPI — NOT in Boot BOM, explicit version required ── -->
    <dependency>
        <groupId>org.springdoc</groupId>
        <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
        <version>${springdoc.version}</version>
    </dependency>

    <!-- ── JWT (JJWT) — NOT in Boot BOM, explicit version required ── -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>${jjwt.version}</version>
    </dependency>

    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>${jjwt.version}</version>
        <scope>runtime</scope>
    </dependency>

    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>${jjwt.version}</version>
        <scope>runtime</scope>
    </dependency>

    <!-- ── Testing ────────────────────────────────────────────────── -->
    <!-- Includes JUnit 5 (6.0.3) and Mockito (5.23.0) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <dependency>
        <groupId>org.springframework.security</groupId>
        <artifactId>spring-security-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- Testcontainers — version 2.0.5 managed by Boot BOM -->
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>postgresql</artifactId>
        <scope>test</scope>
    </dependency>

    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>junit-jupiter</artifactId>
        <scope>test</scope>
    </dependency>

</dependencies>
```

### `pom.xml` — build plugins

```xml
<build>
    <plugins>

        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <excludes>
                    <exclude>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
            </configuration>
        </plugin>

        <!-- MapStruct + Lombok annotation processors must be declared together -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <configuration>
                <source>25</source>
                <target>25</target>
                <annotationProcessorPaths>
                    <!-- lombok-mapstruct-binding must come first -->
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok-mapstruct-binding</artifactId>
                        <version>0.2.0</version>
                    </path>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                        <version>${lombok.version}</version>
                    </path>
                    <path>
                        <groupId>org.mapstruct</groupId>
                        <artifactId>mapstruct-processor</artifactId>
                        <version>${mapstruct.version}</version>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>

    </plugins>
</build>
```

### Version summary

| Library | Managed by Boot BOM? | Version |
|---------|----------------------|---------|
| Spring Boot starters | ✅ | 4.1.0 |
| PostgreSQL driver | ✅ | 42.7.11 |
| Flyway | ✅ | 12.4.0 |
| Lombok | ✅ | 1.18.46 |
| Testcontainers | ✅ | 2.0.5 |
| JUnit Jupiter | ✅ | 6.0.3 |
| Mockito | ✅ | 5.23.0 |
| MapStruct | ❌ | 1.6.3 |
| JJWT | ❌ | 0.13.0 |
| SpringDoc OpenAPI | ❌ | 2.8.9 |
| H2 Database | ✅ | (Boot BOM) |

---
