# infra-aws-ec2 — Deploy script structure

Reference file for the `infra-aws-ec2` skill. Read it when writing the deploy script.

## Deploy Script Structure

Generate **one deploy script per scope** (product-level and per-service), or a combined script. All scripts follow these conventions:

```bash
#!/bin/bash
set -euo pipefail

PRODUCT_NAME="<PRODUCT_NAME>"          # hardcoded — mandatory input
APP_SERVICE_NAME="<APP_SERVICE_NAME>"  # hardcoded — mandatory input

# Shell env vars (never hardcoded):
# ENVIRONMENT, AWS_REGION, AWS_ACCOUNT_ID
```

### Product-level deploy (run once per product)
```bash
# [1] VPC
aws cloudformation deploy \
  --template-file cloudFormation/generic/aws-vpc-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-vpc" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}"

# [2] ECS Infra (Cluster + ALB + ASG + Capacity Provider)
aws cloudformation deploy \
  --template-file cloudFormation/generic/aws-ecs-infra-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-ecs-infra" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}" \
    InstanceType="t3.medium" \
    EbsVolumeSize="20" \
    AsgMinSize="1" \
    AsgDesiredSize="1" \
    AsgMaxSize="1"
```

### Per-service deploy (run once per microservice)
```bash
# [3] CodeBuild + ECR
aws cloudformation deploy \
  --template-file cloudFormation/generic/per-service/aws-codebuild-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-codebuild" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}" \
    AwsAccountId="${AWS_ACCOUNT_ID}" \
    AppServiceName="${APP_SERVICE_NAME}" \
    GitHubOwner="<GITHUB_OWNER>" \
    GitHubRepo="<GITHUB_REPO>" \
    GitHubBranch="<GITHUB_BRANCH>" \
    GitHubConnectionArn="<GITHUB_CONNECTION_ARN>"

# [4] Bootstrap SSM image tag parameter
aws ssm put-parameter \
  --name "/${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-imageTag" \
  --value "latest" \
  --type String \
  --region "${AWS_REGION}"

# [5] IAM roles (includes EC2 instance role + profile)
aws cloudformation deploy \
  --template-file cloudFormation/generic/per-service/aws-iam-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-iam" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}" \
    AppServiceName="${APP_SERVICE_NAME}"

# [6] Aurora PostgreSQL (Secrets Manager secret + subnet group + cluster + writer instance)
aws cloudformation deploy \
  --template-file cloudFormation/generic/per-service/aws-rds-aurora-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-rds" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}" \
    AppServiceName="${APP_SERVICE_NAME}" \
    DbName="<DB_NAME>" \
    DbInstanceClass="db.t3.medium" \
    DeletionProtection="false"

# [7] ECS Service (Task Definition [EC2 launch type] + Service + ALB Rule)
aws cloudformation deploy \
  --template-file cloudFormation/generic/per-service/aws-ecs-service-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-ecs-service" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}" \
    AwsAccountId="${AWS_ACCOUNT_ID}" \
    AppServiceName="${APP_SERVICE_NAME}" \
    ListenerRulePriority="<LISTENER_RULE_PRIORITY>" \
    ContainerPort="<CONTAINER_PORT>" \
    HealthCheckPath="<HEALTH_CHECK_PATH>"

# [8] Start tasks (DesiredCount defaults to 0 — scale up here)
aws ecs update-service \
  --cluster "${ENVIRONMENT}-${PRODUCT_NAME}-cluster" \
  --service "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-service" \
  --desired-count 1 \
  --force-new-deployment \
  --region "${AWS_REGION}"
```

---
