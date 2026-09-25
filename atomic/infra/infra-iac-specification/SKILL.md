---
name: infra-IaC-specification
description: Use when the user invokes %infra-IaC-specification or asks about the cloud-agnostic infrastructure specification for deploying a full-stack multi-microservice application — architecture model, component responsibilities, deployment tiers, networking, compute, database, CI/CD, secrets, and naming conventions, independent of any cloud provider or IaC tool.
---

# Cloud Infrastructure Specification — Full-Stack Multi-Microservice

## When to use this skill
Activate when the user types `%infra-IaC-specification` or asks about the provider-agnostic infrastructure design for deploying a full-stack multi-microservice application. This skill defines the **what** and **why** — the architecture contracts. For the **how** (provider-specific IaC), load the appropriate provider skill on top of this one.

---

## Purpose

This specification defines a reproducible, provider-agnostic infrastructure model for deploying containerised multi-microservice applications. Any cloud provider skill that implements this spec must honour all contracts defined here. Future provider skills (Azure, GCP, Terraform modules, etc.) must derive from and comply with this document.

---

## Architecture Model

The infrastructure is organised in **two tiers**:

### Tier 1 — Product-level infrastructure
Deployed **once per product per environment**. Shared by all microservices of the same product.

| Component | Responsibility |
|---|---|
| **Network** | Isolated virtual network with public and private subnets across at least 2 availability zones |
| **Ingress / Load Balancer** | Single internet-facing HTTP load balancer; routes traffic to microservices by path prefix `/<ServiceName>/*` |
| **Container Orchestration Cluster** | Shared cluster that runs all microservice containers |
| **NAT / Outbound Gateway** | Allows containers in private subnets to reach the internet (pull images, call external APIs) without being publicly reachable |

### Tier 2 — Per-service infrastructure
Deployed **once per microservice per environment**. Isolated per service.

| Component | Responsibility |
|---|---|
| **Container Image Registry** | Private registry storing immutable, versioned container images for the service |
| **CI/CD Build Job** | Builds a Docker image from source, tags it, pushes it to the registry |
| **CI/CD Deploy Trigger** | Event-driven function that detects a successful build, registers a new container definition revision, and triggers a rolling redeployment |
| **Identity & Access** | Grants the container runtime and deploy function the minimum permissions each needs |
| **Relational Database** | Managed PostgreSQL-compatible database cluster; private subnet only; encrypted at rest |
| **Container Service** | Runs the container, wires it to the load balancer, injects configuration |

---

## Architecture Diagram

```
Internet
    │
    └──► Load Balancer (public, HTTP :80)
              │
              ├── /<service-a>/*  → Container Service A (private subnet)
              ├── /<service-b>/*  → Container Service B (private subnet)
              └── /<service-c>/*  → Container Service C (private subnet)
                       │
              Container Service A
                       │
              Relational DB A (private subnet, no public access)
```

- The load balancer is shared across all microservices (product-level).
- Each microservice has its own container service, database, registry, and CI/CD pipeline (per-service).
- No container or database is directly reachable from the internet.
- Outbound internet access for containers goes through the NAT gateway.

---

## Networking Specification

### Subnets

| Subnet type | Hosts | Public IP | Purpose |
|---|---|---|---|
| Public (×2, one per AZ) | Load Balancer, NAT Gateway | Yes | Internet-facing entry points only |
| Private (×2, one per AZ) | Containers, Databases | No | All workloads; no direct internet ingress |

### Security Groups / Firewall Rules

Three security groups are required per product:

| Group | Inbound | Outbound | Purpose |
|---|---|---|---|
| `sg-lb` | TCP :80 from `0.0.0.0/0` | TCP `CONTAINER_PORT` to `sg-app` | Load balancer |
| `sg-app` | TCP `CONTAINER_PORT` from `sg-lb` only | all (for outbound calls) | Application containers |
| `sg-db` | TCP :5432 from `sg-app` only | none | Relational database |

> The database must **never** accept traffic from any source other than `sg-app`. No public access under any circumstances.

### Naming Convention

All network resources follow: `{environment}-{product-name}-{resource-type}`

Examples: `prod-webstore-vpc`, `dev-catalog-sg-db`

---

## Container Compute Specification

### Compute modes

Two modes are supported. The provider skill chooses one:

| Mode | Description | When to prefer |
|---|---|---|
| **Managed Instances** (e.g. EC2 + ASG) | A pool of VMs runs the containers. You pay per VM regardless of container count. | High, steady-state utilisation; need for host-level control or custom AMIs |
| **Serverless Containers** (e.g. Fargate) | No VMs to manage. You pay per container vCPU/memory reservation. | Variable or low utilisation; test/dev cost optimisation |

### Container sizing parameters

| Parameter | Description | Test/Dev default | Prod minimum |
|---|---|---|---|
| `TaskCpu` | vCPU units reserved per container task | 0.5 vCPU | 1 vCPU |
| `TaskMemory` | Memory reserved per container task | 1024 MB | 2048 MB |
| `DesiredCount` | Number of running container instances | 0 (scaled manually after deploy) | 1–3 |
| `ContainerPort` | Port the application listens on inside the container | 8080 | 8080 |
| `HealthCheckPath` | HTTP path the load balancer uses to check container health | `/actuator/health` | `/actuator/health` |

> `DesiredCount` **must default to 0** in all IaC templates. Infrastructure is deployed first; containers are started as a separate explicit step. This allows the deployment pipeline to remain idempotent and predictable.

### Health check parameters

| Parameter | Default |
|---|---|
| `HealthCheckIntervalSeconds` | 30 |
| `HealthCheckTimeoutSeconds` | 5 |
| `HealthyThresholdCount` | 2 |
| `UnhealthyThresholdCount` | 3 |
| `HealthCheckGracePeriodSeconds` | 60 |

### Routing

- Each microservice is routed by **path prefix**: `/<AppServiceName>/*`
- Each path rule must have a **unique priority** within the load balancer listener (provider skill responsibility).
- Default listener action: return `404` with a JSON error body — ensures unmapped paths never reach a backend silently.

### Deployment resilience

- **Minimum healthy percent during rolling deployment:** 50%
- **Maximum percent during rolling deployment:** 200%
- **Automatic rollback on deployment failure:** enabled
- **Container immutability:** task/container definitions are never mutated; each deploy creates a new revision. Old revisions are retained for rollback.

---

## Container Image Registry Specification

- Each microservice has its **own private registry repository**.
- Image tags are **immutable** — once pushed, a tag cannot be overwritten.
- Images are **scanned for vulnerabilities** on push.
- Repository name format: `{environment}-{product-name}-{service-name}-repo`

### Image Tag Strategy

Container image tags are **never hardcoded** in IaC templates. The active image tag is stored in a **managed configuration store** (e.g. SSM Parameter Store, Azure App Configuration) at deploy time:

- Parameter name: `/{environment}-{product-name}-{service-name}-imageTag`
- Bootstrap value: `latest` (set manually before first deploy)
- The IaC template reads the tag dynamically from the config store at deployment time.
- To deploy a new version: update the config store value, then trigger a container service re-deployment.

---

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

## Relational Database Specification

### Engine

- **PostgreSQL-compatible** managed database cluster (e.g. Aurora PostgreSQL, Azure Database for PostgreSQL Flexible Server).
- Multi-AZ capable for production; single-AZ acceptable for dev/test.

### Security

| Rule | Requirement |
|---|---|
| Network access | Private subnet only; no public endpoint |
| Ingress | Only from `sg-app` on port 5432 |
| Encryption at rest | Always enabled |
| Credentials | Auto-generated; stored in a **secrets store** — never in IaC parameters, environment variables, or source control |
| Secret rotation | Supported by the managed secrets service; not required for dev |

### Credentials flow

```
Secrets Store
    │  (auto-generated at DB creation)
    │
    ├──► DB Cluster (master password set from secret)
    │
    └──► Container Task (reads secret at startup via SDK)
              │
              DB_SECRET_ARN env var → application reads username + password
```

The application **must never receive the password as a plaintext environment variable**. It receives only the secret reference (`DB_SECRET_ARN`) and resolves the credentials at runtime.

### Database sizing parameters

| Parameter | Description | Test/Dev default | Prod minimum |
|---|---|---|---|
| `DbInstanceClass` | VM size for the DB writer instance | Small general-purpose | Memory-optimised medium |
| `DbEngineVersion` | PostgreSQL-compatible engine version | `15.4` | `15.4` |
| `BackupRetentionDays` | Automated backup retention period | 7 days | 14 days |
| `DeletionProtection` | Prevents accidental cluster deletion | `false` | `true` |
| `DbName` | Initial database name | `appdb` | service-specific |

### Data safety

- **Deletion policy:** on stack/resource deletion, a **final snapshot** is taken automatically. The cluster is never deleted without a snapshot.
- **Backup policy:** automated daily backups retained per `BackupRetentionDays`.

### Environment variables injected into the container

| Variable | Value |
|---|---|
| `DB_HOST` | Cluster writer endpoint hostname |
| `DB_PORT` | Database port (default `5432`) |
| `DB_NAME` | Database name |
| `DB_SECRET_ARN` | Reference to the secrets store entry containing username and password |

---

## Identity & Access Specification

The container runtime requires exactly two identity roles:

### Execution Role (infrastructure identity)

Grants the container orchestration platform — not the application — permission to:
- Pull the container image from the private registry.
- Write container logs to the centralised logging service.

The application code never assumes this role.

### Task Role (application identity)

Grants the application running inside the container permission to:
- Write logs to the centralised logging service (scoped to its own log group).
- Read its database credentials from the secrets store (scoped to its own secret).
- Any additional AWS/cloud service calls the application needs (added per service).

**Principle of least privilege:** both roles are scoped to the minimum resources required by that specific microservice. No wildcard resource ARNs.

---

## Secrets Management Specification

| Secret type | Storage | Access |
|---|---|---|
| Database credentials | Managed secrets service (e.g. Secrets Manager, Azure Key Vault) | Read by container at runtime via SDK; never in plaintext |
| Git repository token | Managed secrets service (SecureString) | Read by CI/CD pipeline only |
| Container image tag | Configuration store (plain string) | Read by IaC at deploy time; writable by CI/CD pipeline |

Rules:
- Secrets are **never passed as IaC template parameters**.
- Secrets are **never stored in environment variables** directly — only the secret reference is injected.
- Secrets are **never committed to source control**.

---

## Observability Specification

### Logging

- All container stdout/stderr is streamed to a **centralised log management service**.
- Each microservice writes to its own isolated log group: `/{runtime}/{environment}-{product-name}-{service-name}`
- Log retention: 7 days (dev/test), 30 days (prod minimum).
- CI/CD pipeline build logs are also retained in the centralised logging service.

### Health monitoring

- The load balancer performs active health checks on every container instance.
- Unhealthy instances are automatically deregistered from the load balancer.
- The container service detects task failures and replaces them automatically.

---

## Required Input Values

Before generating any provider-specific IaC, the following values must be collected:

| Input | Description | Mandatory | Example |
|---|---|---|---|
| `PRODUCT_NAME` | Short identifier for the product — prefixes all shared resources | Yes | `webstore` |
| `APP_SERVICE_NAME` | Short identifier for the microservice — prefixes all per-service resources | Yes | `catalog` |
| `ENVIRONMENT` | Target environment | Yes | `dev`, `staging`, `prod` |
| `CONTAINER_PORT` | Port the application container listens on | No (default `8080`) | `8080` |
| `HEALTH_CHECK_PATH` | HTTP path used for health checks | No (default `/actuator/health`) | `/actuator/health` |
| `LISTENER_RULE_PRIORITY` | Unique priority for this service's load balancer routing rule | Yes, per service | `10` |
| `GIT_OWNER` | Git organisation or user owning the source repository | Yes | `my-org` |
| `GIT_REPO` | Source repository name | Yes | `catalog-service` |
| `GIT_BRANCH` | Branch to build from | No (default `main`) | `main` |
| `GIT_CONNECTION` | Credential/connection reference for the CI/CD pipeline to authenticate to Git | Yes | provider-specific ARN / secret name |
| `DB_NAME` | Initial database name | No (default `appdb`) | `catalog` |

Runtime variables (never hardcoded in IaC):

| Variable | Description |
|---|---|
| `ENVIRONMENT` | Active deployment environment |
| `CLOUD_REGION` | Target cloud region |
| `CLOUD_ACCOUNT_ID` | Cloud account / subscription identifier |

---

## Resource Naming Convention

All resources follow consistent naming to enable cross-resource discovery and avoid collisions:

| Scope | Pattern | Example |
|---|---|---|
| Product-level | `{environment}-{product-name}-{resource-type}` | `prod-webstore-vpc` |
| Per-service | `{environment}-{product-name}-{service-name}-{resource-type}` | `prod-webstore-catalog-db` |

Tags applied to every resource:

| Tag | Value |
|---|---|
| `ProductName` | `{product-name}` |
| `AppServiceName` | `{service-name}` (per-service resources only) |
| `Environment` | `{environment}` |
| `ManagedBy` | IaC tool name (e.g. `cloudformation`, `terraform`, `bicep`) |

---

## Deployment Order

### Product-level (once per product × environment)

```
[1] Network stack      → VPC / VNet, subnets, security groups, NAT gateway
[2] Cluster stack      → Container orchestration cluster + load balancer
```

### Per-service (once per microservice × environment)

```
[3] Build stack        → Container image registry + CI/CD build job
[4] Bootstrap          → Set initial image tag in configuration store (manual, once)
[5] Identity stack     → Execution role + task role
[6] Database stack     → Managed database cluster + secrets
[7] Service stack      → Container task definition + service + load balancer routing rule
[8] Pipeline stack     → Event bus rule + deploy function (auto-deploy on build success)
[9] Scale up           → Set desired container count to ≥ 1 (manual or automated)
```

### Teardown order (reverse)

```
[1] Pipeline stack     → Remove event bus rule + deploy function
[2] Service stack      → Drain and stop containers; remove routing rule
[3] Database stack     → Final snapshot taken automatically; cluster deleted
[4] Identity stack     → Remove roles
[5] Build stack        → Remove registry and build job
[6] Cluster stack      → Remove load balancer and orchestration cluster
[7] Network stack      → Remove subnets, security groups, VPC/VNet
```

> Always teardown in reverse order to respect cross-resource dependencies. The database is always snapshotted before deletion, regardless of the `DeletionProtection` setting.

---

## Provider Skill Contract

Any skill that implements this specification **must**:

1. Implement all seven component types: Network, Cluster/LB, Registry+Build, Identity, Database, Container Service, and Pipeline (Event Bus + Deploy Function).
2. Follow the two-tier (product-level / per-service) deployment model.
3. Honour the naming convention: `{environment}-{product-name}[-{service-name}]-{resource-type}`.
4. Never hardcode credentials, image tags, or environment names in IaC templates.
5. Default `DesiredCount` / running instance count to **0** — start containers separately.
6. Implement the deploy sub-component as an event-driven function triggered on build success — not as a polling mechanism or manual step.
7. Guard the deploy function against events from unrelated build projects.
8. Sync the deployed image tag to the configuration store after every successful deployment.
6. Store database credentials in a managed secrets service; inject only the secret reference into the container.
7. Scope identity roles to the minimum required by each specific microservice.
8. Apply the four mandatory resource tags on every resource.
9. Use deletion policies that create a database snapshot on teardown.
10. Provide a deploy script (or equivalent) that respects the deployment order above.

---

## How to use this skill
1. Load this skill to understand the cloud-agnostic architecture contracts before implementing or reviewing any cloud deployment.
2. Load the appropriate provider or IaC tool skill on top of this spec for the concrete implementation.
3. When creating a new provider skill, use the Provider Skill Contract section as the compliance checklist.
4. Respond and assist in English unless the user requests another language.
5. Await further instructions from the user and execute them accordingly.
