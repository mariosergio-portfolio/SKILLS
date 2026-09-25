---
name: tech-stack-dotnet
description: Use when the user invokes /tech-stack-dotnet or asks about building a .NET REST API with C# 14, ASP.NET Core 10, Entity Framework Core 10, FluentValidation, xUnit v3, and Testcontainers.
---

# .NET 10 + ASP.NET Core + EF Core REST API

## When to use this skill
Activate when the user types `/tech-stack-dotnet` or needs guidance on the .NET technology stack for a REST API. 

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | C# 14 / .NET 10 (LTS) | Records, primary constructors, extension members, pattern matching |
| Framework | ASP.NET Core 10 | Minimal API or MVC Controllers |
| API style | ASP.NET Core MVC or Minimal APIs | Prefer MVC for larger modular projects |
| Data Access | Entity Framework Core 10 | Code-first with migrations |
| Database | PostgreSQL (recommended) | Via `Npgsql.EntityFrameworkCore.PostgreSQL` |
| Validation | FluentValidation 12.1.1 | Fluent rule definitions per request model; requires .NET 8+ |
| Testing | xUnit v3 (3.2.2) + Moq (4.20.72) + Testcontainers (4.13.0) | Unit, integration, and API tests |
| Build | .NET CLI / MSBuild | Solution (`.sln`) with one project per layer or module |
| Auth | ASP.NET Core Identity + JWT Bearer | Stateless; `Microsoft.AspNetCore.Authentication.JwtBearer` |

### Version summary

| Library | Version |
|---------|---------|
| .NET Runtime | 10.0.x (LTS) |
| C# | 14 |
| ASP.NET Core | 10.0.x |
| Entity Framework Core | 10.0.x |
| Npgsql EF Core provider | aligned with EF Core 10 |
| FluentValidation | 12.1.1 |
| xUnit.net | v3 3.2.2 (`xunit.v3`) |
| Moq | 4.20.72 |
| Testcontainers | 4.13.0 |

---

## Conventions & Patterns

### General
- Use **C# records** for immutable DTOs, request/response models, and value objects.
- Use **discriminated unions via sealed class hierarchies** or `OneOf` for variant types.
- Prefer **constructor injection**; avoid property injection and service locator patterns.
- Use `Result<T>` / `OneOf<TSuccess, TError>` in services instead of throwing exceptions for expected failures.
- Avoid returning `null`; use `T?` with `<Nullable>enable</Nullable>`.

### Naming

| Artefact | Convention | Example |
|----------|------------|---------|
| Domain entity | plain name | `Order`, `Customer` |
| Input Port | `I{Entity}Port` | `IOrderPort` |
| Input Port impl | `{Entity}PortImpl` | `OrderPortImpl` |
| Output Port | `I{Entity}Repository` | `IOrderRepository` |
| Controller | `{Entity}Controller` | `OrderController` |
| Persistence adapter | `{Entity}Repository` | `OrderRepository` |
| EF Core entity | `{Entity}Entity` | `OrderEntity` |
| DTOs | `{Entity}Request`, `{Entity}Response` | `OrderRequest`, `OrderResponse` |

### Domain / EF Core Entities
- Domain entities — **no EF or framework attributes**; plain C# classes/records.
- EF Core entities as `{Entity}Entity` — configured via `IEntityTypeConfiguration<T>` (Fluent API only, no data annotations).
- Use `Guid` as primary key type.
- Map relationships explicitly with `HasMany`/`HasOne` and defined cascade rules.
- Repository implementations map between domain models and EF entities; domain models are never passed to EF directly.

### Service / Input Port Layer
- One Input Port interface per aggregate/entity; all operations grouped on the same interface.
- `{Entity}PortImpl` depends only on Output Port interfaces via constructor injection.
- Register with `AddScoped<IOrderPort, OrderPortImpl>()`.
- Use `DbContext.SaveChanges` (or `IUnitOfWork`) at the service boundary for write transactions.
- `PortImpl` classes never reference EF, HTTP, or any infrastructure concern.

### Exception & Error Handling
- Global middleware via `IExceptionHandler` / `UseExceptionHandler`.
- Custom exceptions: `NotFoundException`, `BusinessRuleException`.
- Return RFC 7807 Problem Details responses (`TypedResults.Problem`).

### Validation
- **FluentValidation 12** per request model; register with `AddFluentValidationAutoValidation()`.
- Validate at the controller/endpoint boundary; services assume valid input.

### Testing
- **Unit tests**: Moq to mock dependencies; test service logic in isolation.
- **Integration tests**: `WebApplicationFactory<T>` + Testcontainers (4.13.0) for database and HTTP-level tests.
- **API tests**: `HttpClient` from `WebApplicationFactory` for end-to-end controller tests.
- Use **xUnit v3** (`xunit.v3`) — not the legacy `xunit` v2 package.

---

## Canonical Project Structure

```
Solution.sln
├── Solution.Domain/            ← SHARED — no framework annotations
│   ├── Model/                  ← Entities, Value Objects, Enums
│   ├── Events/                 ← Domain Events
│   └── Services/               ← Stateless Domain Services
│
├── Solution.Application/
│   ├── Ports/
│   │   ├── In/                 ← I{Entity}Port interfaces
│   │   └── Out/                ← I{Entity}Repository interfaces
│   └── Services/               ← {Entity}PortImpl classes
│
├── Solution.Infrastructure/
│   ├── Rest/                   ← Controllers + DTOs (split by module)
│   ├── Persistence/            ← EF Core entities, repositories, DbContext
│   └── Config/                 ← DI registration, JWT, migrations
│
├── Solution.Shared/
│   ├── Exceptions/
│   └── Utils/
│
└── Solution.Api/               ← Entry point
    ├── Program.cs
    └── appsettings.json
```

---

## How to use this skill
1. Apply this stack, versions, and conventions to any .NET REST API project.
2. Respond and assist in English unless the user requests another language.
3. Await further instructions from the user and execute them accordingly.
