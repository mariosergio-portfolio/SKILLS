---
name: tech-stack-node-express-rest
description: Node.js 24 + Express 5 REST API stack in plain JavaScript (ES modules): pinned npm versions, factory-function modules with a composition root, zod-validated env configuration, pino logging, helmet/CORS/rate limiting, zod request validation, a shared error format, node-postgres, OpenAPI with Swagger UI, graceful shutdown, Docker, and tests with node:test + supertest, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or creating or configuring a Node.js / Express REST service.
---

# Node.js + Express REST API

## Technology Stack

> **Version pins — last verified: 2026-09 (copied from the `package.json` of the `customers-api-node` reference app, not checked against release notes).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Runtime | Node.js | 24.19.0 | `.nvmrc`, `engines.node: ">=24.19.0"`, Docker base `node:24.19.0-alpine` |
| Language | JavaScript, ES modules | — | `"type": "module"`; no TypeScript, no build step. JSDoc on exported functions |
| HTTP framework | Express | 5.2.1 | Rejected promises from async handlers reach the error handler automatically |
| Validation | zod | 4.6.5 | Env config and request params/query/body |
| Logging | pino / pino-http | 10.3.1 / 11.0.0 | JSON logs; `pino-pretty` 13.1.3 (dev dependency) for local output |
| Security | helmet | 8.3.0 | Security headers |
| CORS | cors | 2.8.6 | Origins from configuration |
| Rate limiting | express-rate-limit | 8.7.0 | Per-route limits on expensive endpoints |
| Database | pg (node-postgres) | 8.23.0 | `Pool`, parameterised SQL, no ORM |
| API docs | swagger-ui-express | 5.0.1 | OpenAPI 3.1 document written as a JS object |
| AWS (when needed) | `@aws-sdk/client-*` v3 | 3.1139.0 | One client per service; default credential chain |
| Testing | `node:test` + supertest | built in / 7.3.0 | No Jest or Mocha |
| Lint | eslint + @eslint/js + globals | 10.11.0 / 10.0.1 / 17.12.0 | Flat config `eslint.config.js` |
| Env files | Node built-in `--env-file-if-exists` | — | No `dotenv` package |

Pin **exact** versions (no `^` or `~`): add `save-exact=true` to `.npmrc`, commit `package-lock.json`, and install with `npm ci`.

---

## Project Structure

```
<service-name>/
├── src/
│   ├── server.js                 # Composition root: config, logger, pool, clients, services → createApp → listen; shutdown
│   ├── app.js                    # createApp({ config, logger, …services }) — no I/O at import time
│   ├── config/
│   │   ├── index.js              # loadConfig(env = process.env): zod schema → frozen config object
│   │   └── logger.js             # createLogger(config): pino
│   ├── db/
│   │   └── pool.js               # createPool(dbConfig, logger): pg Pool
│   ├── errors/
│   │   └── index.js              # AppError + BadRequestError, NotFoundError, UpstreamServiceError …
│   ├── middleware/
│   │   ├── errorHandler.js       # errorBody(), notFoundHandler, errorHandler
│   │   └── validate.js           # validate({ params, query, body }) with zod
│   ├── docs/
│   │   └── openapi.js            # export const openApiDocument = { openapi: '3.1.0', … }
│   └── <module>/                 # One folder per feature, files prefixed with the module name
│       ├── <module>.routes.js      # createXRouter(deps): Router, middleware, validation
│       ├── <module>.controller.js  # createXController(deps): read req.valid, call service, write res
│       ├── <module>.service.js     # createXService(deps): business rules, throws AppError subclasses
│       ├── <module>.repository.js  # createXRepository(pool): SQL only
│       ├── <module>.schemas.js     # zod schemas for params/query/body
│       └── <module>.mapper.js      # row → API response shape
├── test/
│   ├── helpers.js                # silentLogger, buildTestApp(), sample rows
│   └── *.test.js
├── .env.example  .nvmrc  .npmrc  .gitignore  .dockerignore
├── Dockerfile
├── eslint.config.js
├── package.json
└── package-lock.json
```

For a service with non-trivial domain logic, map this onto `tech-arch-hexagonal`: the service is the input port implementation, the repository and external clients are driven adapters injected into it, and routes/controllers are the driving adapter.

---

## Conventions & Patterns

### General
- **Factory functions, not classes**, for anything with dependencies: `createXService({ xRepository, logger })` returns an object of methods. Classes only for errors.
- **Dependency injection by hand**: `server.js` is the only place that creates real pools, clients and services. Everything else receives them as parameters, so tests pass fakes.
- Named exports only; relative imports include the `.js` extension; built-ins use the `node:` prefix (`node:crypto`, `node:test`).
- `async`/`await` everywhere; never mix in callbacks. Constants for magic numbers (`const SHUTDOWN_TIMEOUT_MS = 10_000`).
- Freeze configuration (`Object.freeze`) and shared fixtures.

### Naming

| Artefact | Convention | Example |
|----------|------------|---------|
| Files | `<module>.<layer>.js` | `customer.service.js` |
| Factories | `create<Thing>` | `createCustomerRepository` |
| Zod schemas | `<purpose>Schema` | `searchQuerySchema`, `customerParamsSchema` |
| Mappers | `to<Shape>` | `toCustomerResponse` |
| Errors | `<Reason>Error extends AppError` | `NotFoundError` |
| JSON fields | camelCase; DB columns stay snake_case in SQL | `companyId` ← `company_id` |

### Configuration
- `loadConfig(env = process.env)` parses env vars with a zod schema (`z.coerce.number()` for numbers, `z.stringbool()` for booleans, `z.enum` for `NODE_ENV` and `LOG_LEVEL`), supplies defaults, and throws one readable error listing every invalid variable. Nothing else reads `process.env`.
- It returns a nested, frozen object (`config.db.host`, `config.aws.region`), not raw env names.
- Standard variables: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ORIGIN` (comma-separated or `*`), `TRUST_PROXY`, and `DB_*` when there is a database.
- Local values live in `.env`, loaded by `node --env-file-if-exists=.env`; commit only `.env.example`. Secrets and AWS credentials come from the environment or the SDK default provider chain, never from code.

### App factory (`app.js`)
- `createApp(deps)` builds and returns the Express app and does no I/O, so tests create it without a port, database or network.
- Middleware order: `pino-http` (request id from a validated `X-Request-Id` header or `randomUUID()`, echoed in the response; `/health` excluded from access logs) → `helmet()` → `cors({ origin: config.corsOrigin })` → operational routes → docs → `/api` routers → `notFoundHandler` → `errorHandler`.
- `app.set('trust proxy', config.trustProxy)` so rate limiting sees the real client IP behind a load balancer.
- Operational routes outside `/api`: `GET /health` (liveness, always `{"status":"UP"}`) and `GET /ready` (readiness: runs an injected `checkReadiness()` such as `pool.query('SELECT 1')`; `503 {"status":"DOWN"}` on failure).

### Routes, validation, controllers
- Each module exports `createXRouter(deps)`; `app.js` mounts it under `/api`.
- Validate with the `validate({ params, query, body })` middleware. It stores parsed values on `req.valid.*`, because Express 5 makes `req.query` read-only. Controllers read only `req.valid`, never `req.query` or `req.params`.
- Zod schemas coerce and normalise: trim strings, treat blank strings as absent, lower/upper-case enums, and apply defaults. Invalid input becomes a `BadRequestError` naming the parameter and value.
- Controllers are thin: read `req.valid`, call one service method, `res.json(result)` (or set type/headers for binary responses). No try/catch; Express 5 forwards rejections.
- Put `express-rate-limit` on routes that are expensive or paid (external APIs), with `standardHeaders: 'draft-8'`, `legacyHeaders: false`, and a `handler` that returns the standard error body with 429.

### Errors
- `AppError(status, message, { cause })` is the base class; subclasses fix the status (`BadRequestError` 400, `NotFoundError` 404, `UpstreamServiceError` 502). Services throw these; external SDK errors are translated at the adapter boundary, keeping the original as `cause`.
- One error body everywhere: `{ status, message, timestamp }` (ISO-8601), built by `errorBody()`. The same helper is used by the 404 handler and the rate limiter.
- `errorHandler(err, req, res, next)` keeps all four parameters (Express detects error handlers by arity). `AppError` → its status and message (log `warn` for 4xx, `error` for 5xx); Express client errors with `err.expose` → their status; anything else → `500 "An unexpected error occurred"` and the details only in the log. If headers were already sent, destroy the response.

### Database (pg)
- `createPool(dbConfig, logger)` with explicit `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `application_name`, and `ssl: { rejectUnauthorized: true }` when SSL is on. Register `pool.on('error', …)` so an idle-client failure is logged, not fatal.
- Type parsers are set **per pool** (`types: { getTypeParser }`), never globally: `int8` → `Number` when ids fit in 2^53, and `timestamp` → ISO string when the API must return local date-times unchanged.
- Repositories hold SQL only and return rows (`rows[0] ?? null` for single lookups). Always use `$1…$n` parameters. Values that can't be parameterised (`ORDER BY`) come from a fixed whitelist object. Escape `%`, `_` and `\` in user input used with `LIKE`/`ILIKE` and add `ESCAPE '\'`.
- Mappers convert rows to the API shape; services never return raw rows.

### External clients
- Create SDK clients once in `server.js`, inject them, and `destroy()` them on shutdown.
- Cache lookups as **promises** in a `Map` so concurrent callers share one request, and remove the entry when the promise rejects so failures aren't cached.

### Logging
- One pino logger from `createLogger(config)`: `name`, `level` from config, `redact` for `authorization` and `cookie` headers, `pino-pretty` transport only in `development`.
- Inside requests use `req.log` (carries the request id). Log objects first: `logger.info({ companyId }, 'Customer search')`. Never log secrets or full request bodies.

### OpenAPI / Swagger UI
- The contract is `src/docs/openapi.js` (OpenAPI 3.1), updated in the same change as the route. Define shared schemas under `components.schemas`, including the error body.
- Serve the same URLs as the Spring stack:
  ```js
  app.get('/v3/api-docs', (req, res) => res.json(openApiDocument));
  app.get(['/swagger-ui.html', '/swagger-ui/index.html'], (req, res) => res.redirect('/swagger-ui/'));
  app.use('/swagger-ui', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  ```
  The redirects must be registered before `swaggerUi.serve`; otherwise `/swagger-ui/index.html` is the stock `swagger-ui-dist` page (the Petstore demo) instead of your spec. (The reference app serves `swaggerUi.serve` without `setup()`, which makes `GET /swagger-ui/` return 404 and fails its own test.)
- A test asserts `/v3/api-docs` returns the document and `/swagger-ui/` loads `swagger-ui-init.js` with your title.

### Server lifecycle (`server.js`)
- Register `unhandledRejection` and `uncaughtException` handlers that log `fatal` and `process.exit(1)`.
- `app.listen(port, (err) => …)`: Express 5 passes listen errors to the callback; log a clear hint for `EADDRINUSE` and exit.
- On `SIGTERM`/`SIGINT`: guard against running twice, start an `unref()`'d force-exit timer (10 s), `server.close()` + `server.closeIdleConnections()`, then `pool.end()` and client `destroy()`, then exit 0.

### Testing
- `node --test "test/**/*.test.js"`; `node:assert/strict`; `describe`/`it`; `mock.fn()` for fakes.
- `test/helpers.js` exports `silentLogger` (`pino({ level: 'silent' })`) and `buildTestApp({ …fakes, env })`, which calls the real `loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env })` and `createApp`.
- Route tests use supertest against `buildTestApp` with fake services and cover: happy path with normalised input, defaults, every 400 rule, 404/502 mapping, the generic 500 hiding details, CORS headers, rate limit, `/health`, `/ready` DOWN, docs, and the JSON 404.
- Service tests inject fake repositories/clients and assert both results and the arguments passed down.
- The suite needs no database, network or AWS credentials. Repository SQL is covered by integration tests against a real PostgreSQL (e.g. a Docker container) when the project has them.

### Lint
- `eslint.config.js` flat config: `js.configs.recommended`, `globals.node`, `sourceType: 'module'`, plus `no-unused-vars` (ignore `^_` args), `eqeqeq` (`null: 'ignore'`), `prefer-const`, `no-var`. Ignore `node_modules/` and `coverage/`.

### Docker
- `FROM node:<pinned>-alpine`, `ENV NODE_ENV=production`, copy `package.json` + `package-lock.json` first and `npm ci --omit=dev --ignore-scripts && npm cache clean --force`, then copy `src/` only.
- `USER node`, `EXPOSE <port>`, `HEALTHCHECK` with `wget -qO- http://127.0.0.1:<port>/health`.
- `CMD ["node", "src/server.js"]`, not `npm start`, so `SIGTERM` reaches Node.
- `.dockerignore`: `node_modules`, `coverage`, `test`, `.git`, `.env`, `.env.*`, `*.log`.

### npm scripts

| Script | Command |
|--------|---------|
| `start` | `node --env-file-if-exists=.env src/server.js` |
| `dev` | `node --watch --env-file-if-exists=.env src/server.js` |
| `test` | `node --test "test/**/*.test.js"` |
| `test:coverage` | `node --test --experimental-test-coverage "test/**/*.test.js"` |
| `lint` | `eslint .` |

---

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table. Don't pull "latest" from memory or let npm pick it: install with `npm install --save-exact <pkg>@<version>`.
- Scaffold the skeleton only: package files, layout, configuration, logging, error handling, health/readiness, Swagger UI, Docker, and smoke tests. Add no example domain module, database pool or AWS client unless asked.
- If Node.js or npm is missing, say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

**Inputs:** service name (e.g. `billing-api`) · port (default `8080`) · PostgreSQL: yes / **no** (default).

1. **Package.** `package.json` with `"type": "module"`, `"private": true`, `engines.node`, `main: src/server.js` and the npm scripts above. Add `.npmrc` (`save-exact=true`) and `.nvmrc` (the pinned Node version). Install express, zod, pino, pino-http, helmet, cors, express-rate-limit and swagger-ui-express, plus pg if PostgreSQL is yes; dev: eslint, @eslint/js, globals, pino-pretty, supertest. All at the table's versions.
2. **Config and logging.** `src/config/index.js` (zod env schema with `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ORIGIN`, `TRUST_PROXY`, and `DB_*` if PostgreSQL) and `src/config/logger.js`. Write `.env.example` with every variable.
3. **Errors and middleware.** `src/errors/index.js`, `src/middleware/errorHandler.js`, `src/middleware/validate.js` as described above.
4. **Docs.** `src/docs/openapi.js` with `info`, the error schema, and `/health`.
5. **App.** `src/app.js` with the middleware order above, `/health`, `/ready` (with an injected `checkReadiness`), the docs routes, an empty `/api` mount point, and the 404 and error handlers.
6. **Server.** `src/server.js`: load config, create logger (and pool if PostgreSQL, with `checkReadiness: () => pool.query('SELECT 1')`), `createApp`, listen, and graceful shutdown.
7. **Tests.** `test/helpers.js` and `test/app.test.js` covering `/health` = 200 `{"status":"UP"}`, `/ready` = 503 when `checkReadiness` rejects, `/v3/api-docs` + `/swagger-ui/`, the JSON 404, and a config test that `loadConfig` rejects an invalid `PORT`.
8. **Repo files.** `eslint.config.js`, `.gitignore` (`node_modules/`, `coverage/`, `.env`, `.env.*`, `!.env.example`, logs, IDE/OS files), `.dockerignore`, `Dockerfile`, and a `README.md` with configuration, run, test, lint, Docker and Swagger URLs.
9. **Verify.** Run `npm ci`, `npm run lint` and `npm test`. Then `npm start`, check `curl -s localhost:<port>/health` and `curl -s -o /dev/null -w "%{http_code}" localhost:<port>/swagger-ui/`, and stop with Ctrl+C, checking the "Shutdown complete" log. If Docker is available, `docker build` the image.

## Done criteria (new project)

- [ ] `npm run lint` is clean and `npm test` is green, with no database, network or credentials needed.
- [ ] Every dependency in `package.json` is an exact version matching this skill's table, and `package-lock.json` is committed.
- [ ] The app starts, `/health` returns `{"status":"UP"}`, `/v3/api-docs` returns the document, and `/swagger-ui/` shows **your** spec (not the Petstore demo).
- [ ] Invalid configuration fails at startup with a readable list of problems.
- [ ] Ctrl+C / `SIGTERM` shuts down gracefully and closes the pool if there is one.
- [ ] No secrets in the repo: `.env` is git-ignored and only `.env.example` is committed.
- [ ] `README.md` explains configuration, run, test and Docker. Anything not verified is listed explicitly in your reply.
