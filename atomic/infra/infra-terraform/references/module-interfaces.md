# infra-terraform — Module interface specification

Reference file for the `infra-terraform` skill. Read it when writing or implementing any Layer 1 module (variables and outputs).

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
