# infra-terraform — Deployment order and scripts

Reference file for the `infra-terraform` skill. Read it when writing deploy scripts or planning apply order.

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
