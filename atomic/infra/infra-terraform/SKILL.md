---
name: infra-terraform
description: Terraform implementation of infra-iac-specification: three-layer modules (abstract interface, provider implementation, root), remote state and locking, workspaces, variable conventions, secrets handling, naming, and deploy scripts. Use when writing or reviewing Terraform for this architecture on any cloud.
---

# Terraform IaC Implementation — infra-iac-specification

## Scope

**This skill is a tool-layer implementation of `infra-iac-specification`** — it defines how every contract in that specification is realised using Terraform, regardless of the target cloud provider.

Load a cloud-specific provider skill on top of this one for the concrete resource definitions (e.g. `infra-terraform-aws`, `infra-terraform-azure` — not yet included in this library). This skill alone is sufficient to define the full structure, interfaces, variable conventions, state strategy, and patterns; the provider skill fills in the actual `resource` blocks.

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

Every Terraform implementation of the `infra-iac-specification` uses **three distinct layers**. This is the key design rule — mixing layers is the most common mistake.

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

## Module Map — infra-iac-specification → Terraform Layers

| infra-iac-specification component | Abstract contract | Provider implementation | Deploys at |
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

Details: [references/module-interfaces.md](references/module-interfaces.md). Read it when writing or implementing any Layer 1 module (variables and outputs).

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

Details: [references/variables.md](references/variables.md). Read it when declaring variables or writing tfvars files.

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

Apply the `infra-iac-specification` naming pattern using Terraform `locals`:

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

Details: [references/root-modules.md](references/root-modules.md). Read it when writing terraform/product or terraform/service root modules.

## Deployment Order & Scripts

Details: [references/deployment.md](references/deployment.md). Read it when writing deploy scripts or planning apply order.

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

## infra-iac-specification Contract Compliance

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
1. Load `infra-iac-specification` for the cloud-agnostic architecture contracts this skill implements.
2. Load a cloud-provider skill (e.g. `infra-terraform-aws` — not yet included in this library) for the concrete `resource` blocks inside `providers/<cloud>/`.
3. Apply the three-layer structure, variable conventions, state strategy, and module interfaces defined here to all Terraform IaC work.
4. Always run `terraform fmt`, `terraform validate`, and `tflint` before committing or opening a pull request.
