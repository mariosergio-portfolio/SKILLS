# infra-terraform — Root modules

Reference file for the `infra-terraform` skill. Read it when writing terraform/product or terraform/service root modules.

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
