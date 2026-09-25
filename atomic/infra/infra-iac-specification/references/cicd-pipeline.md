# infra-iac-specification — CI/CD pipeline component specification

Reference file for the `infra-iac-specification` skill. Read it when designing or implementing the build and deploy pipeline.

## CI/CD Pipeline Component Specification

Each microservice has its own CI/CD pipeline, composed of two sub-components:

- **Build sub-component** — compiles the source, builds and pushes the Docker image.
- **Deploy sub-component** — detects a successful build and rolls the new image out to the container service automatically.

Both sub-components are deployed as part of the per-service infrastructure tier.

---

### Build Sub-Component

#### Responsibilities

1. **Triggered** by a push to the configured source branch of the linked Git repository.
2. **Builds** a Docker image from the source using a pipeline definition file (`buildspec.yml` or equivalent) at the repository root.
3. **Tags** the image with the `IMAGE_TAG` value passed at build-trigger time.
4. **Pushes** the tagged image to the private container image registry.
5. **Exports** `IMAGE_TAG` as a build-time environment variable so the deploy sub-component can read it.

#### Source repository connection

- Source: **GitHub** (OAuth or Personal Access Token).
- The connection credential is stored in a **secrets store** — never hardcoded in pipeline configuration or IaC parameters.
- The connection must be active and authorised before the pipeline stack is deployed.

#### Build-time environment variables

| Variable | Description |
|---|---|
| `REGISTRY_URI` | URI of the private container registry |
| `IMAGE_TAG` | Tag to apply to the built image — passed explicitly at build-trigger time |
| `ENVIRONMENT` | Target environment (`dev`, `staging`, `prod`) |

#### Manual build trigger

A build can be triggered manually by starting the build job and passing `IMAGE_TAG` as an override:

```bash
# trigger a build with a specific image tag
<build-tool> start-build \
  --project {environment}-{product-name}-{service-name}-build \
  --env IMAGE_TAG=1.2.0
```

---

### Deploy Sub-Component

The deploy sub-component is **event-driven** — it reacts to a successful build automatically without polling or manual intervention.

#### Architecture

```
Build job reaches SUCCEEDED state
        │
        ▼
Event Bus Rule
  (filter: source = build service, status = SUCCEEDED, project = this service's build job)
        │
        ▼
Deploy Function  (serverless function — zero cost at idle)
        │  step 1 — read IMAGE_TAG from the completed build's environment variables
        │  step 2 — fetch the current container task/service definition
        │  step 3 — clone the definition; swap the container image to the new tag
        │  step 4 — register the cloned definition as a new immutable revision
        │  step 5 — trigger a rolling redeployment of the container service
        │  step 6 — persist IMAGE_TAG to the configuration store (single source of truth)
        ▼
Container service rolls out new tasks
  (deployment circuit breaker handles automatic rollback on failure)
```

#### Why event-driven instead of a pipeline orchestrator?

A dedicated pipeline orchestrator (e.g. AWS CodePipeline, Azure DevOps Pipeline) adds cost and complexity for a single action: "build succeeded → redeploy". An Event Bus + serverless function achieves the same result with zero idle cost, no pipeline stage configuration, and simpler infrastructure.

Use a pipeline orchestrator only when the deployment workflow has multiple sequential stages (test → staging → approval gate → prod).

#### Deploy function responsibilities

| Step | Action |
|---|---|
| **Guard** | Verify the event is from the expected build project and that the status is `SUCCEEDED` — ignore all other events |
| **Read tag** | Extract `IMAGE_TAG` from the completed build's exported environment variables; fall back to a configured `FALLBACK_TAG` if not present |
| **Fetch definition** | Retrieve the current active container task/service definition |
| **Clone + swap** | Copy all fields of the definition except read-only metadata; replace the container image URI with `{registry-uri}:{image-tag}` |
| **Register** | Register the modified definition as a new immutable revision — never mutate the existing one |
| **Deploy** | Trigger a forced rolling redeployment of the container service pointing at the new revision |
| **Sync** | Write the deployed `IMAGE_TAG` to the configuration store — keeps the IaC state in sync without triggering a stack update |

#### Deploy function environment variables

| Variable | Value |
|---|---|
| `CLUSTER_NAME` | Container orchestration cluster identifier |
| `SERVICE_NAME` | Container service identifier |
| `TASK_FAMILY` | Container task/service definition family name |
| `REGISTRY_URI` | Base URI of the private container registry (without tag) |
| `CONTAINER_NAME` | Name of the container definition to update within the task |
| `CONFIG_PARAM_NAME` | Configuration store key where the active image tag is persisted |
| `FALLBACK_TAG` | Image tag used when `IMAGE_TAG` is absent from the build event (default: `latest`) |
| `BUILD_PROJECT_NAME` | Expected build project name — used to guard against events from other projects |

#### Deploy function identity (least privilege)

The deploy function requires exactly the following permissions, all scoped to the specific service:

| Permission | Scope | Purpose |
|---|---|---|
| Write logs | Own log group only | Function execution logs |
| Read build details | Own build project only | Extract `IMAGE_TAG` from the completed build |
| Describe + register task definitions | All (required by ECS API) | Fetch current definition and register new revision |
| Update + describe container service | All (required by ECS API) | Trigger rolling redeployment |
| Put + get configuration store parameter | Own `imageTag` parameter only | Persist deployed tag |
| Pass identity roles to container runtime | Scoped to container runtime service | Allow ECS to assume task execution and task roles |

#### Event bus rule filter

The rule must match **only** the following event attributes — it must never trigger on unrelated build projects:

| Attribute | Expected value |
|---|---|
| Event source | Container build service (e.g. `aws.codebuild`) |
| Event type | Build state change |
| Build status | `SUCCEEDED` only |
| Project name | Exactly `{environment}-{product-name}-{service-name}-build` |

#### Fallback tag behaviour

If `IMAGE_TAG` is not present in the build event (e.g. a build triggered without an explicit tag override), the deploy function uses `FALLBACK_TAG` instead of failing. This prevents deployment stalls during manual or bootstrapping builds. The fallback value must be set to a known-good tag for the service — `latest` is acceptable for dev/test only.

#### Configuration store sync

After every successful deployment, the deploy function writes the deployed `IMAGE_TAG` to the configuration store at the key `/{environment}-{product-name}-{service-name}-imageTag`. This is the **single source of truth** for the currently running image tag:

- The container service IaC template reads this value at deploy time to determine which image revision to run.
- Updating this value and triggering a re-deployment is the standard mechanism for rolling back to a previous image tag.
- Writing directly to the configuration store (rather than updating the IaC template) avoids triggering a full stack re-evaluation that could conflict with the live container service state.

---

### Pipeline Parameters

| Parameter | Description | Mandatory | Default |
|---|---|---|---|
| `PRODUCT_NAME` | Product identifier — scopes all pipeline resources | Yes | — |
| `APP_SERVICE_NAME` | Microservice identifier | Yes | — |
| `ENVIRONMENT` | Target environment | Yes | — |
| `GIT_OWNER` | Git organisation or user | Yes | — |
| `GIT_REPO` | Source repository name | Yes | — |
| `GIT_BRANCH` | Branch to build | No | `main` |
| `GIT_CONNECTION` | Secrets store reference for the Git authentication credential | Yes | — |
| `FALLBACK_TAG` | Image tag used when build event has no `IMAGE_TAG` | No | `latest` |
| `LOG_RETENTION_DAYS` | Deploy function log retention | No | `14` |

### Prerequisites (deploy order)

The pipeline stack depends on these per-service stacks already being deployed:

```
[1] Registry + build job stack    → provides the build project name and registry URI
[2] Identity stack                → provides the task execution role and task role ARNs
[3] Container service stack       → provides the ECS cluster, service, and task family names
[4] Pipeline stack                → event bus rule + deploy function
```

---
