---
name: tech-stack-go-gin-rest
description: Go 1.26 + Gin 1.12 REST API stack: pinned module versions, go.mod hygiene, cmd/internal layout with handler/service/model per module, env-based configuration with godotenv, CORS, request binding and validation, embedded OpenAPI spec with Swagger UI, goroutine concurrency patterns (WaitGroup, atomic, mutex, bounded pools), and testing with the standard library, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or creating or configuring a Go / Gin REST service.
---

# Go + Gin REST API

## Technology Stack

> **Version pins — last verified: 2026-09 (copied from the `go.mod` of the `parallelism-go` reference app, not checked against release notes).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Language | Go | 1.26 | `go 1.26` directive in `go.mod`; per-iteration loop variables, `sync.WaitGroup.Go`, `testing/synctest` |
| HTTP framework | Gin (`github.com/gin-gonic/gin`) | v1.12.0 | Router, groups, middleware, query/JSON binding |
| CORS | `github.com/gin-contrib/cors` | v1.7.7 | Origins from configuration, never hard-coded |
| Validation | `github.com/go-playground/validator/v10` | v10.30.1 | Used by Gin through `binding:"..."` struct tags; no direct import needed |
| Configuration | `github.com/joho/godotenv` | v1.5.1 | Loads `.env` in dev; real env vars win in every environment |
| OpenAPI | `gopkg.in/yaml.v3` + hand-written `docs/swagger.yaml` | v3.0.1 | Spec-first; the spec is embedded with `//go:embed` and served with Swagger UI 5 |
| Concurrency | Standard library `sync`, `sync/atomic`, channels | — | No third-party worker-pool libraries |
| Testing | Standard library `testing` + `net/http/httptest` | — | Table-driven tests; always run with `-race` |
| Build | Go toolchain (`go build`, `go vet`, `gofmt`) | — | Single static binary |

Libraries not in this table (database drivers, JWT, `errgroup`, linters) are added only when a task needs them, and their version is pinned in this table at that moment.

---

## go.mod hygiene

- Module path: `github.com/mycompany/<service-name>`.
- A library the code imports goes in the first `require` block **without** `// indirect`. Run `go mod tidy` after every import change; it fixes the markers and drops unused modules. (The reference app lists `gin-contrib/cors`, `godotenv` and `yaml.v3` as indirect although it imports them, and carries an unused `mongo-driver/v2`: both are what `go mod tidy` removes.)
- Commit `go.mod` and `go.sum`. Never commit `vendor/`, `go.work` or `go.work.sum`.
- Don't add a `toolchain` line unless the team needs a newer patch than the `go` directive implies.

---

## Project Structure

```
<service-name>/
├── cmd/
│   └── main.go                  # Entry point: load config, build services and handlers, start the server
├── internal/                    # Not importable from outside the module
│   ├── config/
│   │   └── config.go            # Config struct + Load() from env / .env
│   ├── router/
│   │   └── router.go            # gin.Engine, middleware, route table
│   └── <module>/                # One folder per feature (e.g. order, prime)
│       ├── handler/             # Gin handlers: bind, validate, call service, write JSON
│       ├── service/             # Business logic and concurrency; no Gin imports
│       └── model/               # Request/response structs with json tags, constructors
├── docs/
│   ├── swagger.yaml             # OpenAPI 3.0 spec (source of truth for the contract)
│   ├── docs.go                  # //go:embed swagger.yaml + SwaggerUIHandler
│   └── swagger_ui.go            # Swagger UI HTML
├── .env                         # Local only, git-ignored
├── go.mod
└── go.sum
```

- When the module ships more than one binary, use `cmd/<binary>/main.go`.
- For a service with persistence, map this onto `tech-arch-hexagonal`: `service` owns the input port, a small repository interface lives in `service`, and its implementation goes in `internal/<module>/repository/`.

---

## Conventions & Patterns

### General
- `gofmt` formatting and `go vet` clean; no exceptions.
- Package names are short, lower case, singular, no underscores (`handler`, `service`, `model`). Alias on import when two collide: `counterhandler "…/internal/counter/handler"`.
- Constructors are `New<Type>(deps…) *<Type>`. Wire everything by hand in `main.go`; no DI framework.
- "Accept interfaces, return structs": a handler depends on a small interface declared **in the handler package** (only the methods it calls), so tests can pass a fake. `main.go` passes the concrete `*service.X`.
- Return `error` as the last value; wrap with `fmt.Errorf("…: %w", err)`. Never `panic` outside `init`/startup.
- Pass `context.Context` (from `c.Request.Context()`) as the first parameter to any service method that does I/O or can be cancelled.
- Constants for magic numbers (`const maxEstimatedMs = 60_000`); no commented-out code in commits.

### Naming

| Artefact | Convention | Example |
|----------|------------|---------|
| Handler struct | `<Entity>Handler` | `CounterHandler` |
| Handler method | verb phrase | `Count`, `FindPrimes` |
| Service struct | `<Entity>Service` | `PrimeService` |
| Response DTO | `<Entity>Response` | `CounterResponse` |
| Model constructor | `New<Type>` | `NewCounter`, `NewCounterSummary` |
| File | `<entity>_<layer>.go` | `counter_handler.go`, `counter_service.go` |
| JSON fields | camelCase via tags | `json:"completedTimeMs"` |

### Configuration
- `config.Load()` calls `godotenv.Load()` (a missing `.env` is logged, not fatal), then reads `os.Getenv` with defaults, and returns a `*Config`. Nothing else reads env vars.
- Standard variables: `APP_PORT` (default `8081`) and `CORS_ALLOWED_ORIGINS` (comma-separated; trim and drop empty entries).
- Default CORS origins to `*` in development only. `AllowCredentials: true` must not be combined with `*` in production; require an explicit origin list there.
- Secrets come from the environment; `.env` is git-ignored.

### Router & middleware
- `router.Setup(handlers…, cfg)` returns `*gin.Engine`; `main.go` never registers routes.
- `gin.Default()` (Logger + Recovery), then CORS via `cors.New(cors.Config{…})`.
- All business endpoints under `api := r.Group("/api")`. Health at `GET /health` and Swagger UI at `GET /swagger-ui/index.html`, both outside the group.
- Set `gin.SetMode(gin.ReleaseMode)` from config (`GIN_MODE=release`) in production.

### Handlers
- Declare the request as a struct with `form:"…"` (query) or `json:"…"` (body) tags plus `binding:"required,min=1"` rules, and bind with `c.ShouldBindQuery` / `c.ShouldBindJSON`. Never use the `Bind*` variants: they write the response themselves.
- On bind error: `400` with one error body, then `return`.
- Errors use one helper that writes RFC 9457 Problem Details (`application/problem+json` with `type`, `title`, `status`, `detail`), matching the other stacks. (The reference app returns `{"error": "..."}`; new services use Problem Details.)
- Handlers contain no business logic and no goroutines; they bind, call the service, map to the response model, and `c.JSON(http.StatusOK, resp)`.
- Cap large result lists in the response (the reference app returns the first 100 items plus the last) and document the cap in the spec.

### Models
- Plain structs with `json` tags; no Gin imports.
- Format times in UTC; keep one layout constant per package (`const TimeFormat = "15:04:05.000Z"`). Expose milliseconds as `int64` (`UnixMilli()`).

### OpenAPI / Swagger UI
- The contract is `docs/swagger.yaml` (OpenAPI 3.0.3), written by hand and updated in the same change as the handler.
- `docs/docs.go` embeds it with `//go:embed swagger.yaml`, converts it to JSON once in `init()` (panic on a malformed spec: it fails at startup, not at request time), and `SwaggerUIHandler` serves an HTML page with the spec inlined. No separate spec endpoint is required.
- Swagger UI assets load from `swagger-ui-dist@5` on a CDN; pin the major version.

### Concurrency
- Goroutines live in the **service** layer only, and every goroutine the service starts has finished before the method returns.
- **Bounded pool** (parallelism = N): split the work into N contiguous ranges (`chunk := (n + workers - 1) / workers`), one goroutine per range, and wait with a `sync.WaitGroup`. On Go 1.25+ prefer `wg.Go(func() { … })` over `wg.Add(1)` + `defer wg.Done()`.
- **One goroutine per task**: fine for I/O-bound work (a parked goroutine costs ~2–8 KB and no OS thread). Don't do it for CPU-bound work; cap CPU-bound workers at `runtime.NumCPU()`.
- **Results without locks**: pre-allocate `results := make([]T, n)` and let each goroutine write only its own index.
- **Shared maps/slices**: guard with `sync.Mutex`, keep the critical section to the write only.
- **Counters and flags**: `atomic.Int64`, `atomic.Bool` (typed atomics, not `atomic.AddInt64` on a plain int). Use an `atomic.Bool` for early exit and check it at the top of each loop iteration.
- Since Go 1.22 the loop variable is per-iteration, so closures may capture it directly; passing it as a goroutine parameter is still fine for clarity.
- For request-scoped work that can fail or be cancelled, respect `ctx.Done()`; add `golang.org/x/sync/errgroup` (and pin it above) when you need error propagation.
- Don't parse `runtime.Stack` for goroutine IDs. If a worker label is needed, use a counter (`atomic.Int64.Add(1)`).
- Parallel results that must be ordered are sorted after `wg.Wait()`, never while workers are running.

### Server lifecycle
- Build an `http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 5 * time.Second}` instead of `r.Run`, run it in a goroutine, and shut down gracefully on `SIGINT`/`SIGTERM` with `signal.NotifyContext` + `srv.Shutdown(ctx)` (10 s timeout).
- Log with `log/slog` (JSON handler in production). Don't log full URLs that may carry secrets.

### Testing
- Table-driven unit tests next to the code (`counter_service_test.go`, same package).
- Handler tests: `gin.SetMode(gin.TestMode)`, build the engine with `router.Setup` (or a minimal engine with a fake service), drive it with `httptest.NewRecorder()` + `httptest.NewRequest`, and assert status and JSON.
- Concurrency code is tested with `go test -race`; use `testing/synctest` to test `time.Sleep`-based code without real waiting.
- `go test ./...` must pass without network or `.env`.

---

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table. Don't pull "latest" from memory, and if `go get` resolves a different version, pin it back with `go get <module>@<version>`.
- Scaffold the skeleton only: module, layout, configuration, a health check, Swagger UI, and one smoke test. Add no example domain code unless asked.
- If the Go toolchain is missing, say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

**Inputs:** service name (e.g. `billing`) · module path (default `github.com/mycompany/<name>`) · port (default `8081`).

1. **Module.** `go mod init <module path>`, set the `go 1.26` directive, then `go get` Gin, gin-contrib/cors, godotenv and yaml.v3 at the table's versions.
2. **Layout.** Create `cmd/`, `internal/config/`, `internal/router/`, `docs/` as in Project Structure. No module folders yet.
3. **Configuration.** `internal/config/config.go` with `APP_PORT` and `CORS_ALLOWED_ORIGINS` as described above, plus a `.env.example` (committed) listing both.
4. **Router.** `internal/router/router.go`: `gin.Default()`, CORS, an empty `/api` group, `GET /health` returning `{"status":"UP"}`, and the Swagger UI route.
5. **OpenAPI.** `docs/swagger.yaml` with `info`, `servers: [{url: /api}]` and the `/health` path; `docs/docs.go` and `docs/swagger_ui.go` as described above.
6. **Entry point.** `cmd/main.go`: load config, set up the router, run an `http.Server` with graceful shutdown.
7. **Smoke test.** `internal/router/router_test.go` asserting `GET /health` returns `200` and `{"status":"UP"}`.
8. **Repo files.** `.gitignore` (binaries, `*.test`, `*.out`, `vendor/`, `go.work*`, `bin/`, `dist/`, IDE folders, `.env`), and a `README.md` with how to run, build, test and open Swagger UI.
9. **Verify.** Run `go mod tidy`, `gofmt -l .` (must print nothing), `go vet ./...`, `go test -race ./...` and `go build -o bin/<name> ./cmd`. Then start with `go run ./cmd`, check `curl -s localhost:<port>/health` and `curl -s -o /dev/null -w "%{http_code}" localhost:<port>/swagger-ui/index.html`, and stop the app.

## Done criteria (new project)

- [ ] `go vet ./...` is clean, `gofmt -l .` prints nothing, and `go test -race ./...` is green with the smoke test run.
- [ ] `go mod tidy` leaves `go.mod`/`go.sum` unchanged, directly imported modules are not marked `// indirect`, and versions match this skill's table.
- [ ] The app starts, `/health` returns `{"status":"UP"}`, and Swagger UI returns `200`.
- [ ] The server shuts down cleanly on Ctrl+C.
- [ ] No secrets in the repo: `.env` is git-ignored and only `.env.example` is committed.
- [ ] `README.md` explains run, build and test. Anything not verified is listed explicitly in your reply.
