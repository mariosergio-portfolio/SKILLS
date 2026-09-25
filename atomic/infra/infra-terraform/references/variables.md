# infra-terraform — Variable conventions

Reference file for the `infra-terraform` skill. Read it when declaring variables or writing tfvars files.

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
