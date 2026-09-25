---
name: infra-terraform
description: Use when the user invokes %infra-terraform or asks about implementing the infra-IaC-specification using Terraform — three-layer module structure, variable conventions, state management, provider configuration, workspace strategy, and how each infra-IaC-specification component maps to Terraform modules.
---

# Terraform IaC Implementation — infra-IaC-specification

## When to use this skill
Activate when the user types `%infra-terraform` or asks about implementing the cloud infrastructure specification with Terraform.

**This skill is a tool-layer implementation of `%infra-IaC-specification`** — it defines how every contract in that specification is realised using Terraform, regardless of the target cloud provider.

Load a cloud-specific provider skill on top of this one for the concrete resource definitions (e.g. `%infra-terraform-aws`, `%infra-terraform-azure`). This skill alone is sufficient to define the full structure, interfaces, variable conventions, state strategy, and patterns; the provider skill fills in the actual `resource` blocks.

---

## Terraform Version & Tool Requirements

| Tool | Version | Notes |
|---|---|---|
| Terraform | `>= 1.9.0` | Use the latest stable 1.x release; avoid 0.x |
| terraform CLI | same | Used for `init`, `plan`, `apply`, `destroy` |
| tfenv (optional) | latest | Version manager — pin version in `.terraform-version` |
| tflint | `>= 0.50` | Linting; run in CI before every plan |
| terraform-docs | `>= 0.18` | Auto-generate `README.md` from variable/output blocks |

`.terraform-version` (pin exact version):
```
1.9.8
```

---

## Three-Layer Structure

Every Terraform implementation of the `%infra-IaC-specification` uses **three distinct layers**. This is the key design rule — mixing layers is the most common mistake.

| Layer | Location | Contains | Cloud-specific? |
|---|---|---|---|
| **Abstract contract** | `modules/<component>/` | `variables.tf`, `outputs.tf`, doc comment in `main.tf` — **no resources** | No |
| **Provider implementation** | `providers/<cloud>/<component>/` | All `resource` and `data` blocks for the target cloud | Yes |
| **Root modules** | `product/`, `service/` | Provider block, backend config, module calls pointing at `providers/<cloud>/` | Yes (provider block only) |

**Rule:** `modules/` never contains a `resource` block. `providers/<cloud>/` never contains business logic — only resource declarations that satisfy the module contract. Root modules are the only place a `provider {}` block appears.

---

## Project Structure

```
infrastructure/
├── terraform/
│   ├── modules/                         ← Layer 1: provider-agnostic contracts
│   │   ├── network/                     ← variables.tf + outputs.tf + doc main.tf
│   │   ├── cluster/
│   │   ├── registry/
│   │   ├── pipeline/
│   │   ├── identity/
│   │   ├── database/
│   │   └── service/
│   │
│   ├── providers/                       ← Layer 2: cloud provider implementations
│   │   ├── aws/                         ← AWS implementation of every module contract
│   │   │   ├── network/
│   │   │   ├── cluster/
│   │   │   ├── registry/
│   │   │   ├── pipeline/
│   │   │   ├── identity/
│   │   │   ├── database/
│   │   │   └── service/
│   │   ├── azure/                       ← (future) Azure implementation
│   │   └── gcp/                         ← (future) GCP implementation
│   │
│   ├── product/                         ← Layer 3: product-level root module (Tier 1)
│   │   ├── main.tf                      ← calls providers/<cloud>/network + cluster
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf                  ← provider block + backend config
│   │   └── terraform.tfvars.example
│   │
│   └── service/                         ← Layer 3: per-service root module (Tier 2)
│       ├── main.tf                      ← calls providers/<cloud>/* for all per-service modules
│       ├── variables.tf
│       ├── outputs.tf
│       ├── versions.tf
│       └── terraform.tfvars.example
│
├── envs/
│   ├── dev/
│   │   ├── product.tfvars
│   │   └── <service-name>.tfvars
│   ├── staging/
│   │   ├── product.tfvars
│   │   └── <service-name>.tfvars
│   └── prod/
│       ├── product.tfvars
│       └── <service-name>.tfvars
│
└── scripts/
    ├── deploy-product.sh
    ├── deploy-service.sh
    └── teardown.sh
```

---

## Module Map — infra-IaC-specification → Terraform Layers

| infra-IaC-specification component | Abstract contract | Provider implementation | Deploys at |
|---|---|---|---|
| Network | `modules/network` | `providers/<cloud>/network` | Product-level |
| Cluster + Load Balancer | `modules/cluster` | `providers/<cloud>/cluster` | Product-level |
| Container Image Registry | `modules/registry` | `providers/<cloud>/registry` | Per-service |
| CI/CD Pipeline | `modules/pipeline` | `providers/<cloud>/pipeline` | Per-service |
| Identity & Access | `modules/identity` | `providers/<cloud>/identity` | Per-service |
| Relational Database | `modules/database` | `providers/<cloud>/database` | Per-service |
| Container Service | `modules/service` | `providers/<cloud>/service` | Per-service |

Root modules call `providers/<cloud>/<component>` — never `modules/<component>` directly.

---

## Module Interface Specification (Layer 1 — Abstract Contracts)

Each `modules/<component>/` exposes a consistent interface. All modules accept `common_tags` and `prefix` as inputs. The `main.tf` in each module contains only a documentation comment — no `resource` blocks.

### `modules/network`

```hcl
# inputs
variable "prefix"                {}   # e.g. "prod-webstore"
variable "network_cidr"          { default = "10.0.0.0/16" }
variable "public_subnet_cidrs"   { default = ["10.0.0.0/24", "10.0.1.0/24"] }
variable "private_subnet_cidrs"  { default = ["10.0.10.0/24", "10.0.11.0/24"] }
variable "availability_zones"    {}   # list of 2+ zones
variable "container_port"        { default = 8080 }
variable "common_tags"           {}

# outputs
output "network_id"          {}   # VPC / VNet ID
output "public_subnet_ids"   {}
output "private_subnet_ids"  {}
output "sg_lb_id"            {}   # load-balancer security perimeter
output "sg_app_id"           {}   # application container security perimeter
output "sg_db_id"            {}   # database security perimeter
```

### `modules/cluster`

```hcl
# inputs
variable "prefix"             {}
variable "network_id"         {}
variable "public_subnet_ids"  {}
variable "sg_lb_id"           {}
variable "common_tags"        {}

# outputs
output "cluster_id"       {}
output "cluster_arn"      {}
output "lb_arn"           {}
output "lb_listener_id"   {}   # HTTP listener ID/ARN — consumed by per-service routing rules
output "lb_dns_name"      {}
```

### `modules/registry`

```hcl
# inputs
variable "prefix"      {}   # e.g. "prod-webstore-catalog"
variable "common_tags" {}

# outputs
output "repository_url" {}   # full URI used to push/pull images
output "repository_id"  {}   # registry repository ARN / full resource ID
```

### `modules/pipeline`

```hcl
# inputs
variable "prefix"                {}
variable "repository_url"        {}
variable "git_owner"             {}
variable "git_repo"              {}
variable "git_branch"            { default = "main" }
variable "git_connection"        {}   # provider-specific credential/connection reference
variable "image_tag_param_name"  {}   # config store key for the active image tag
variable "cluster_name"          {}
variable "service_name"          {}
variable "task_family"           {}
variable "container_name"        {}
variable "fallback_tag"          { default = "latest" }
variable "log_retention_days"    { default = 14 }
variable "common_tags"           {}

# outputs
output "pipeline_name" {}
output "pipeline_id"   {}
```

### `modules/identity`

```hcl
# inputs
variable "prefix"        {}
variable "log_group_id"  {}   # log group ARN/ID — scopes log-write permission
variable "db_secret_id"  {}   # secret ARN/ID — scopes secret-read permission
variable "common_tags"   {}

# outputs
output "execution_role_id" {}   # granted to the container runtime (pull images, write logs)
output "task_role_id"      {}   # granted to the application code (write logs, read secret)
```

### `modules/database`

```hcl
# inputs
variable "prefix"                {}
variable "db_name"               { default = "appdb" }
variable "engine_version"        { default = "15.4" }
variable "instance_class"        {}   # provider-specific compute class
variable "private_subnet_ids"    {}
variable "sg_db_id"              {}
variable "backup_retention_days" { default = 7 }
variable "deletion_protection"   { default = false }
variable "common_tags"           {}

# outputs
output "db_endpoint"  {}
output "db_port"      { value = 5432 }
output "db_name"      {}
output "db_secret_id" { sensitive = true }   # secrets store ARN/ID; never the password
```

### `modules/service`

```hcl
# inputs
variable "prefix"                  {}
variable "cluster_id"              {}
variable "lb_listener_id"          {}
variable "listener_rule_priority"  {}
variable "network_id"              {}
variable "private_subnet_ids"      {}
variable "sg_app_id"               {}
variable "execution_role_id"       {}
variable "task_role_id"            {}
variable "repository_url"          {}
variable "image_tag_param_name"    {}
variable "container_port"          { default = 8080 }
variable "health_check_path"       { default = "/actuator/health" }
variable "task_cpu"                { default = 512 }
variable "task_memory"             { default = 1024 }
variable "desired_count"           { default = 0 }
variable "db_host"                 {}
variable "db_port"                 { default = 5432 }
variable "db_name"                 {}
variable "db_secret_id"            {}
variable "log_retention_days"      { default = 7 }
variable "common_tags"             {}

# outputs
output "service_name"   {}
output "service_id"     {}
output "task_family"    {}
output "log_group_id"   {}   # consumed by identity module to scope log-write permission
```

---

## Provider Implementation Rules (Layer 2)

Each `providers/<cloud>/<component>/` must:

1. Declare its own `terraform { required_providers { ... } }` block — never inherit from the root module.
2. Implement **every output** declared in the corresponding `modules/<component>/outputs.tf`.
3. Accept **every variable** declared in the corresponding `modules/<component>/variables.tf`, with the same names and types.
4. Contain **no provider `{}` block** — the provider is configured only in the root module.
5. Follow the lifecycle rules described below.

### Lifecycle rules (apply in every provider implementation)

**Database — prevent accidental deletion:**
```hcl
lifecycle {
  prevent_destroy = true        # blocks terraform destroy on prod
  ignore_changes  = [password]  # password managed by secrets store after creation
}
```

**Container task/service definition — retain old revisions for rollback:**
```hcl
lifecycle {
  create_before_destroy = true
  ignore_changes        = [task_definition, desired_count]
}
```

**Container image registry — never deleted by Terraform:**
```hcl
lifecycle {
  prevent_destroy = true
}
```

---

## Terraform State Management

### Remote state backend

State is stored **remotely** — never locally. Each root module has its own isolated state file. The backend type is chosen by the provider implementation:

```hcl
# versions.tf — product root module (provider-agnostic skeleton)
terraform {
  required_version = ">= 1.9.0"

  backend "<backend-type>" {
    # All values passed via -backend-config at terraform init time.
    # The backend block cannot use variables — never hardcode values here.
    # AWS example:   backend "s3"      { bucket, key, region, encrypt, dynamodb_table }
    # Azure example: backend "azurerm" { resource_group_name, storage_account_name, container_name, key }
    # GCP example:   backend "gcs"     { bucket, prefix }
  }

  required_providers {
    # Declared by the provider implementation — e.g. hashicorp/aws ~> 5.0
  }
}
```

### State file naming convention

| Scope | State key |
|---|---|
| Product-level | `{environment}/{product-name}/product.tfstate` |
| Per-service | `{environment}/{product-name}/{service-name}/service.tfstate` |

### State isolation rules
- Product-level and per-service root modules use **separate state files** — never one shared state.
- Different environments (`dev`, `staging`, `prod`) always use **separate state files**.
- Never use `terraform import` on production resources without a runbook and peer review.

### Cross-module data sharing

Product-level outputs are consumed by the per-service root module via a **remote state data source** — never by copy-pasting values:

```hcl
# service/main.tf — read product-level outputs
data "terraform_remote_state" "product" {
  backend = "<backend-type>"   # same type as product/versions.tf backend
  config = {
    # Provider-specific config keys — passed as variables, never hardcoded
    # AWS:   bucket = var.state_bucket, key = "...", region = var.cloud_region
    # Azure: resource_group_name = var.state_rg, storage_account_name = var.state_account, ...
    # GCP:   bucket = var.state_bucket, prefix = "..."
  }
}

locals {
  product = data.terraform_remote_state.product.outputs
}

# Consume product outputs
network_id         = local.product.network_id
private_subnet_ids = local.product.private_subnet_ids
sg_app_id          = local.product.sg_app_id
```

---

## Workspace Strategy

Use **Terraform workspaces** for environment isolation when the backend supports it, or use **separate state keys** (recommended for multi-account or multi-subscription setups).

### Option A — Separate state keys per environment (recommended)
```bash
# dev
terraform init -backend-config="envs/dev/backend.conf"
terraform apply -var-file="envs/dev/product.tfvars"

# prod
terraform init -backend-config="envs/prod/backend.conf"
terraform apply -var-file="envs/prod/product.tfvars"
```

### Option B — Workspaces (single account, multiple environments)
```bash
terraform workspace new dev
terraform workspace select dev
terraform apply -var-file="envs/dev/product.tfvars"
```

> Prefer Option A for production — separate accounts/subscriptions provide stronger blast-radius isolation.

---

## Variable Conventions

### Required variables — all root modules

```hcl
variable "environment" {
  type        = string
  description = "Deployment environment — dev, staging, or prod."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "product_name" {
  type        = string
  description = "Short product identifier — prefixes all shared resources."
}

variable "cloud_region" {
  type        = string
  description = "Target cloud region (provider-specific format — e.g. 'us-east-1', 'eastus', 'europe-west1')."
}
```

> Use `cloud_region` — not `aws_region`, `azure_location`, or any provider-specific name. The root module maps this to the provider-specific attribute internally.

### Per-service additional variables

```hcl
variable "app_service_name" {
  type        = string
  description = "Microservice identifier — prefixes all per-service resources."
}

variable "container_port"          { type = number; default = 8080 }
variable "health_check_path"       { type = string; default = "/actuator/health" }
variable "listener_rule_priority"  { type = number }   # unique per service within the LB
variable "task_cpu"                { type = number; default = 512 }
variable "task_memory"             { type = number; default = 1024 }
variable "desired_count"           { type = number; default = 0 }

variable "db_name"                 { type = string; default = "appdb" }
variable "db_instance_class"       { type = string }   # provider-specific compute class
variable "db_engine_version"       { type = string; default = "15.4" }
variable "backup_retention_days"   { type = number; default = 7 }
variable "deletion_protection"     { type = bool;   default = false }

variable "log_retention_days"      { type = number; default = 7 }

variable "git_owner"               { type = string }
variable "git_repo"                { type = string }
variable "git_branch"              { type = string; default = "main" }
variable "git_connection"          { type = string; sensitive = true }

variable "state_bucket"            { type = string }   # or equivalent backend reference
```

### Variable files (`.tfvars`)

```hcl
# envs/dev/product.tfvars
environment  = "dev"
product_name = "webstore"
cloud_region = "us-east-1"
```

```hcl
# envs/dev/catalog.tfvars
environment            = "dev"
product_name           = "webstore"
app_service_name       = "catalog"
cloud_region           = "us-east-1"
state_bucket           = "<state-bucket>"
container_port         = 8080
health_check_path      = "/actuator/health"
listener_rule_priority = 10
task_cpu               = 512
task_memory            = 1024
desired_count          = 0
db_name                = "catalogdb"
db_instance_class      = "<provider-specific-class>"
deletion_protection    = false
log_retention_days     = 7
git_owner              = "my-org"
git_repo               = "catalog-service"
git_branch             = "main"
```

> Never commit `.tfvars` files containing sensitive values. Use environment variables or a secrets store for credentials.

---

## Sensitive Values — Never in tfvars or State

Sensitive values (database passwords, Git tokens, API keys) must **never** appear in:
- `.tfvars` files
- `terraform.tfstate` (mark outputs `sensitive = true`)
- Source control

```hcl
# Inject at apply time via TF_VAR_ environment variables
export TF_VAR_git_connection="<provider-specific-connection-reference>"

# Or read from the provider's secrets store via a data source
# (implemented in providers/<cloud>/<component>/ — not in the abstract module)
```

Mark all sensitive outputs:
```hcl
output "db_secret_id" {
  value     = <provider_resource>.<name>.<id_or_arn>
  sensitive = true
}
```

---

## Resource Naming Convention

Apply the `infra-IaC-specification` naming pattern using Terraform `locals`:

```hcl
# product/main.tf
locals {
  prefix = "${var.environment}-${var.product_name}"

  common_tags = {
    ProductName = var.product_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# service/main.tf
locals {
  prefix = "${var.environment}-${var.product_name}-${var.app_service_name}"

  common_tags = {
    ProductName    = var.product_name
    AppServiceName = var.app_service_name
    Environment    = var.environment
    ManagedBy      = "terraform"
  }
}
```

Use `local.prefix` on every resource name and pass `local.common_tags` to every provider implementation module. The provider module merges it with a resource-specific `Name` tag:

```hcl
# Inside providers/<cloud>/network/main.tf
tags = merge(var.common_tags, { Name = "${var.prefix}-network" })
```

---

## Product-Level Root Module (`terraform/product/main.tf`)

```hcl
locals {
  prefix = "${var.environment}-${var.product_name}"
  common_tags = {
    ProductName = var.product_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "network" {
  source = "../providers/<cloud>/network"   # swap <cloud> to target a different provider

  prefix               = local.prefix
  network_cidr         = var.network_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
  container_port       = var.container_port
  common_tags          = local.common_tags
}

module "cluster" {
  source = "../providers/<cloud>/cluster"

  prefix            = local.prefix
  network_id        = module.network.network_id
  public_subnet_ids = module.network.public_subnet_ids
  sg_lb_id          = module.network.sg_lb_id
  common_tags       = local.common_tags
}
```

```hcl
# product/outputs.tf — expose values consumed by per-service remote state
output "network_id"        { value = module.network.network_id }
output "public_subnet_ids" { value = module.network.public_subnet_ids }
output "private_subnet_ids"{ value = module.network.private_subnet_ids }
output "sg_app_id"         { value = module.network.sg_app_id }
output "sg_db_id"          { value = module.network.sg_db_id }
output "cluster_id"        { value = module.cluster.cluster_id }
output "cluster_arn"       { value = module.cluster.cluster_arn }
output "lb_listener_id"    { value = module.cluster.lb_listener_id }
output "lb_dns_name"       { value = module.cluster.lb_dns_name }
```

---

## Per-Service Root Module (`terraform/service/main.tf`)

```hcl
data "terraform_remote_state" "product" {
  backend = "<backend-type>"
  config  = { /* provider-specific backend config — all values from variables */ }
}

locals {
  product         = data.terraform_remote_state.product.outputs
  prefix          = "${var.environment}-${var.product_name}-${var.app_service_name}"
  image_tag_param = "/${var.environment}-${var.product_name}-${var.app_service_name}-imageTag"

  common_tags = {
    ProductName    = var.product_name
    AppServiceName = var.app_service_name
    Environment    = var.environment
    ManagedBy      = "terraform"
  }
}

module "registry" {
  source      = "../providers/<cloud>/registry"
  prefix      = local.prefix
  common_tags = local.common_tags
}

module "database" {
  source                = "../providers/<cloud>/database"
  prefix                = local.prefix
  db_name               = var.db_name
  engine_version        = var.db_engine_version
  instance_class        = var.db_instance_class
  private_subnet_ids    = local.product.private_subnet_ids
  sg_db_id              = local.product.sg_db_id
  backup_retention_days = var.backup_retention_days
  deletion_protection   = var.deletion_protection
  common_tags           = local.common_tags
}

module "service" {
  source                 = "../providers/<cloud>/service"
  prefix                 = local.prefix
  cluster_id             = local.product.cluster_id
  lb_listener_id         = local.product.lb_listener_id
  listener_rule_priority = var.listener_rule_priority
  network_id             = local.product.network_id
  private_subnet_ids     = local.product.private_subnet_ids
  sg_app_id              = local.product.sg_app_id
  execution_role_id      = module.identity.execution_role_id
  task_role_id           = module.identity.task_role_id
  repository_url         = module.registry.repository_url
  image_tag_param_name   = local.image_tag_param
  container_port         = var.container_port
  health_check_path      = var.health_check_path
  task_cpu               = var.task_cpu
  task_memory            = var.task_memory
  desired_count          = var.desired_count
  db_host                = module.database.db_endpoint
  db_port                = module.database.db_port
  db_name                = module.database.db_name
  db_secret_id           = module.database.db_secret_id
  log_retention_days     = var.log_retention_days
  common_tags            = local.common_tags

  depends_on = [module.identity, module.database]
}

module "identity" {
  source        = "../providers/<cloud>/identity"
  prefix        = local.prefix
  log_group_id  = module.service.log_group_id
  db_secret_id  = module.database.db_secret_id
  common_tags   = local.common_tags

  depends_on = [module.service, module.database]
}

module "pipeline" {
  source               = "../providers/<cloud>/pipeline"
  prefix               = local.prefix
  repository_url       = module.registry.repository_url
  git_owner            = var.git_owner
  git_repo             = var.git_repo
  git_branch           = var.git_branch
  git_connection       = var.git_connection
  image_tag_param_name = local.image_tag_param
  cluster_name         = local.product.cluster_id
  service_name         = module.service.service_name
  task_family          = module.service.task_family
  container_name       = local.prefix
  common_tags          = local.common_tags

  depends_on = [module.service, module.registry]
}
```

---

## Deployment Order & Scripts

### Product-level deploy

```bash
#!/usr/bin/env bash
# scripts/deploy-product.sh
set -euo pipefail

PRODUCT_NAME="<PRODUCT_NAME>"   # hardcoded — mandatory

# Runtime env vars (never hardcoded):
# ENVIRONMENT, CLOUD_REGION, STATE_BUCKET (or equivalent backend reference)

cd terraform/product

terraform init \
  -backend-config="envs/${ENVIRONMENT}/backend.conf"

terraform plan \
  -var-file="../../envs/${ENVIRONMENT}/product.tfvars" \
  -out=tfplan

terraform apply tfplan
```

### Per-service deploy

```bash
#!/usr/bin/env bash
# scripts/deploy-service.sh
set -euo pipefail

PRODUCT_NAME="<PRODUCT_NAME>"
APP_SERVICE_NAME="<APP_SERVICE_NAME>"

# Runtime env vars (never hardcoded):
# ENVIRONMENT, CLOUD_REGION, STATE_BUCKET (or equivalent)
# TF_VAR_git_connection — sensitive; injected at runtime, never in tfvars

cd terraform/service

# [1] Bootstrap image tag in config store (once per service, idempotent)
# Provider-specific — see providers/<cloud>/pipeline/ README

# [2] Init
terraform init \
  -backend-config="envs/${ENVIRONMENT}/backend.conf"

# [3] Plan
terraform plan \
  -var-file="../../envs/${ENVIRONMENT}/${APP_SERVICE_NAME}.tfvars" \
  -var="state_bucket=${STATE_BUCKET}" \
  -out=tfplan

# [4] Apply (desired_count = 0 by default — containers started separately)
terraform apply tfplan
```

### Teardown (reverse order)

```bash
# Per-service first
cd terraform/service
terraform destroy \
  -var-file="../../envs/${ENVIRONMENT}/${APP_SERVICE_NAME}.tfvars" \
  -var="state_bucket=${STATE_BUCKET}"

# Product-level last
cd ../product
terraform destroy \
  -var-file="../../envs/${ENVIRONMENT}/product.tfvars"
```

---

## Conventions & Patterns

- **All resources tagged** — use `merge(local.common_tags, { Name = "..." })` on every resource in the provider implementation; never set tags inline without the common set.
- **No hardcoded values** — every attribute that varies by environment, product, service, or cloud comes from a variable or local.
- **No `count` for environment branching** — use separate `.tfvars` files and separate state; never `count = var.environment == "prod" ? 1 : 0`.
- **`depends_on` only for implicit dependencies** — Terraform resolves most dependencies automatically; use explicit `depends_on` only when a dependency is not expressed through resource references.
- **`desired_count = 0` default** — containers are never started by Terraform; scale-up is a separate explicit step.
- **`sensitive = true`** on all outputs that expose secrets, secret references, or credentials.
- **`terraform fmt` before every commit** — enforced via pre-commit hook.
- **`terraform validate` in CI** — run before every plan.
- **`tflint` in CI** — run with the provider plugin matching the target cloud (e.g. `tflint-ruleset-aws`, `tflint-ruleset-azurerm`).
- **No local state** — `terraform.tfstate` and `terraform.tfstate.backup` are in `.gitignore`.
- **Commit `.terraform.lock.hcl`** — it pins provider version hashes and ensures reproducible `terraform init` across machines and CI.

---

## `.gitignore`

```
# Terraform state — always remote
*.tfstate
*.tfstate.backup
.terraform/
tfplan

# Lock file — commit this
# .terraform.lock.hcl

# Variable files with secrets
*.auto.tfvars
secrets.tfvars
```

---

## Switching Cloud Providers

To target a different cloud:

1. Add `providers/<new-cloud>/<component>/` implementing the same variable/output contracts defined in `modules/<component>/`.
2. In `product/main.tf` and `service/main.tf`, change every `source = "../providers/<old-cloud>/..."` to `"../providers/<new-cloud>/..."`.
3. Update `product/versions.tf` and `service/versions.tf` — swap the `required_providers` block and the `backend` type.
4. Update `envs/*/backend.conf` with the new backend configuration.

The `modules/` contracts, `envs/*.tfvars` variable files, and `scripts/` deploy scripts require no changes.

---

## infra-IaC-specification Contract Compliance

| Contract rule | Terraform implementation |
|---|---|
| All 7 component types implemented | One abstract module + one provider implementation per component type |
| Two-tier deployment model | Separate `product/` and `service/` root modules |
| Three-layer structure | `modules/` (contract) → `providers/<cloud>/` (implementation) → root modules (wiring) |
| Naming convention | `local.prefix` applied to all resource names via `common_tags` |
| No hardcoded credentials or cloud-specific names in contracts | Variables only; provider specifics confined to `providers/<cloud>/` |
| `DesiredCount = 0` default | `variable "desired_count" { default = 0 }` |
| DB credentials in secrets store | Provider implementation creates secret; `modules/service` contract receives only `db_secret_id` |
| Least-privilege identity | Provider implementation scopes policies to specific `log_group_id` and `db_secret_id` |
| Four mandatory tags on every resource | `merge(local.common_tags, { Name = "..." })` in every provider implementation |
| DB snapshot on teardown | `lifecycle { prevent_destroy = true }` in provider implementation |
| Deploy script respects deployment order | `deploy-product.sh` always before `deploy-service.sh` |

---

## How to use this skill
1. Load `%infra-IaC-specification` for the cloud-agnostic architecture contracts this skill implements.
2. Load a cloud-provider skill (e.g. `%infra-terraform-aws`) for the concrete `resource` blocks inside `providers/<cloud>/`.
3. Apply the three-layer structure, variable conventions, state strategy, and module interfaces defined here to all Terraform IaC work.
4. Always run `terraform fmt`, `terraform validate`, and `tflint` before committing or opening a pull request.
5. Respond and assist in English unless the user requests another language.
6. Await further instructions from the user and execute them accordingly.
