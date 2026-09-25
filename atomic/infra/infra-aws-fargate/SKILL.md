---
name: infra-aws-FARGATE
description: Use when the user invokes %infra-aws-FARGATE or asks about deploying a full-stack application (frontend + backend) on AWS using CloudFormation IaC with ECS Fargate launch type — serverless compute, no EC2 instances to manage, cost-effective for test/dev.
---

# AWS Full-Stack Deployment — ECS Fargate (CloudFormation IaC)

## When to use this skill
Activate when the user types `%infra-aws-FARGATE` or asks about deploying a full-stack application on AWS using ECS with the **Fargate launch type** (serverless — no EC2 instances or ASG to manage).

**This skill is a provider implementation of `%infra-IaC-specification`** — it realises every contract defined in that specification using AWS CloudFormation, ECS Fargate, Aurora PostgreSQL, and CodeBuild.

> **Why Fargate for test/dev?** No idle EC2 host cost — you pay only for the vCPU/memory reserved by running tasks. A single `0.5 vCPU / 1024 MB` task costs ~$0.016/hour (~$11.50/month). Compare to 1 × `t3.medium` EC2 host ~$30/month regardless of task count.

---

## Architecture Model: Product + Services (Multi-Microservice)

The real stack layout is **two-tier**:

1. **Product-level infrastructure** (deployed once per product per environment):
   - VPC, subnets, security groups, NAT Gateway → `aws-vpc-stack.yml`
   - Shared ECS Cluster + ALB (HTTP :80 with default 404 action) → `aws-ecs-infra-stack.yml`

2. **Per-service infrastructure** (deployed once per microservice per environment — all stacks under `per-service/`):
   - CodeBuild project + ECR repository → `aws-codebuild-stack.yml`
   - IAM roles (task execution + task) → `aws-iam-stack.yml`
   - **RDS Aurora cluster (PostgreSQL-compatible)** → `aws-rds-aurora-stack.yml`
   - ECS Task Definition + ECS Service + ALB Listener Rule + Target Group → `aws-ecs-service-stack.yml`

Multiple microservices (e.g. `catalog`, `orders`, `payments`) share the same VPC, ECS Cluster, and ALB. Each gets its own ALB path-based rule: `/<AppServiceName>/*`.

```
Internet
    │
    └──► ALB (internet-facing, HTTP :80)
              │
              ├── /catalog/*   → ECS Fargate Service (catalog)
              ├── /orders/*    → ECS Fargate Service (orders)
              └── /payments/*  → ECS Fargate Service (payments)
                       │
              (private subnets, AssignPublicIp: DISABLED, outbound via NAT)
```

---

## Image Tag Strategy — SSM Parameter Store

Container images are **not** hardcoded in CloudFormation. The ECS Task Definition reads the image tag from SSM Parameter Store at deploy time:

- SSM parameter name: `/${Environment}-${ProductName}-${AppServiceName}-imageTag`
- The image URI is composed as: `${EcrRepoUri}:{{resolve:ssm:/${Environment}-${ProductName}-${AppServiceName}-imageTag}}`
- **Bootstrap before first deploy:**
  ```bash
  aws ssm put-parameter \
    --name /${Environment}-${ProductName}-${AppServiceName}-imageTag \
    --value latest \
    --type String \
    --region ${AWS_REGION}
  ```
- To redeploy with a new tag: update the SSM parameter value, then run `aws ecs update-service --force-new-deployment`.
- **Do NOT pass `ImageTag` as a CloudFormation parameter** — it is resolved dynamically from SSM.

---

## CI/CD: CodeBuild + ECR

The `aws-codebuild-stack.yml` creates:
- An **ECR repository** (`${Environment}-${ProductName}-${AppServiceName}-repo`) with `ImageTagMutability: IMMUTABLE` and `ScanOnPush: true`.
- A **CodeBuild project** that builds the Docker image and pushes it to ECR.
- A **CodeBuild IAM role** with policies for: ECR push, CloudWatch Logs, S3 artifacts, GitHub CodeConnections, and CodeBuild Reports.
- Source: **GitHub** via AWS CodeConnections (OAuth or PAT). The `GitHubConnectionArn` must exist and be in `AVAILABLE` state before deploying.

### Manual build trigger
```bash
aws codebuild start-build \
  --project-name ${Environment}-${ProductName}-${AppServiceName}-codebuild \
  --environment-variables-override name=IMAGE_TAG,value=1.0.0,type=PLAINTEXT \
  --region ${AWS_REGION}
```

### Redeployment after a new image
```bash
# 1. Build & push (CodeBuild — see above)
# 2. Force ECS to pull the new image:
aws ecs update-service \
  --cluster ${Environment}-${ProductName}-cluster \
  --service ${Environment}-${ProductName}-${AppServiceName}-service \
  --desired-count 1 \
  --force-new-deployment \
  --region ${AWS_REGION}
```

---

## GitHub Connection (CodeConnections)

Two options to authenticate CodeBuild to a private GitHub repository:

### Option A — OAuth (console, one-time, recommended)
1. AWS Console → CodeBuild → Source credentials → Connect to GitHub → OAuth.
2. All CodeBuild projects in the account/region reuse it automatically.
3. Pass the generated ARN as `GitHubConnectionArn` at deploy time.

### Option B — Personal Access Token via SSM
```bash
aws ssm put-parameter \
  --name /webstore/codebuild/github-token \
  --value "ghp_xxxxxxxxxxxx" \
  --type SecureString \
  --region ${AWS_REGION}
```

> `GitHubConnectionArn` has **no default** in the template — it **must** be passed via `--parameter-overrides` at deploy time.

---

## Task & Sizing Parameter Reference

| Resource | CloudFormation Parameter | Test/Dev (default) | Prod (minimum) |
|---|---|---|---|
| **Task CPU** | `TaskCpu` | `512` (½ vCPU) | `1024` (1 vCPU) |
| **Task memory** | `TaskMemory` | `1024 MB` | `2048 MB` |
| **ECS desired count** | `DesiredCount` | `0` ⚠️ default 0 — scaled via `aws ecs update-service` | `1`–`3` |
| **Log retention** | `LogRetentionDays` | `7` | `30` |
| **Health check interval** | `HealthCheckIntervalSeconds` | `30` | `30` |
| **Health check timeout** | `HealthCheckTimeoutSeconds` | `5` | `5` |
| **Healthy threshold** | `HealthyThresholdCount` | `2` | `2` |
| **Unhealthy threshold** | `UnhealthyThresholdCount` | `3` | `3` |
| **Aurora instance class** | `DbInstanceClass` | `db.t3.medium` | `db.r6g.large` |
| **Aurora engine version** | `AuroraEngineVersion` | `15.4` | `15.4` |
| **Aurora backup retention** | `BackupRetentionDays` | `7` | `14` |
| **Aurora deletion protection** | `DeletionProtection` | `false` | `true` |

> ⚠️ `DesiredCount` defaults to **0** in `aws-ecs-service-stack.yml`. This is intentional — CloudFormation deploys the infrastructure without starting tasks. Tasks are started (and scaled) separately via `aws ecs update-service --desired-count N --force-new-deployment`.

---

## Required Input Values

Before generating any code, **ask the user for the following values**:

| Input | Description | Mandatory | Example |
|---|---|---|---|
| `PRODUCT_NAME` | Short product identifier — used to name ALL shared resources | ⚠️ **Yes** | `webstore` |
| `APP_SERVICE_NAME` | Microservice component name — namespaces per-service resources | ⚠️ **Yes** | `catalog` |
| `CONTAINER_PORT` | Port the container listens on | No (default `8080`) | `8080` |
| `HEALTH_CHECK_PATH` | ALB health check path | No (default `/actuator/health`) | `/actuator/health` |
| `LISTENER_RULE_PRIORITY` | Unique ALB listener rule priority (1–50000) | ⚠️ **Yes, per service** | `10` |
| `GITHUB_OWNER` | GitHub organisation or user | ⚠️ **Yes (for CodeBuild)** | `my-org` |
| `GITHUB_REPO` | GitHub repository name | ⚠️ **Yes (for CodeBuild)** | `my-repo` |
| `GITHUB_BRANCH` | Branch to build | No (default `main`) | `main` |
| `GITHUB_CONNECTION_ARN` | AWS CodeConnections ARN for GitHub | ⚠️ **Yes (for CodeBuild)** | `arn:aws:codeconnections:...` |
| `DB_NAME` | Aurora database name | No (default `appdb`) | `catalog` |

> The following values are **shell environment variables** in deploy scripts — never hardcoded:
> - `ENVIRONMENT` — `dev`, `staging`, or `prod`
> - `AWS_REGION` — target AWS region
> - `AWS_ACCOUNT_ID` — AWS account ID (12-digit)

---

## CloudFormation Stack Structure

```
cloudFormation/
├── generic/
│   ├── aws-vpc-stack.yml              ← VPC, subnets, IGW, NAT, security groups (once per product)
│   ├── aws-ecs-infra-stack.yml        ← ECS Cluster + ALB shared infrastructure (once per product)
│   └── per-service/
│       ├── aws-codebuild-stack.yml    ← ECR repo + CodeBuild project (once per microservice)
│       ├── aws-iam-stack.yml          ← ECS task execution role + task role (once per microservice)
│       ├── aws-rds-aurora-stack.yml   ← Aurora PostgreSQL cluster + subnet group + secret (once per microservice)
│       └── aws-ecs-service-stack.yml  ← Task definition, ECS service, ALB rule, TG (once per microservice)
```

> All templates are **generic** — no product-specific values are hardcoded. Everything is driven by parameters (`ProductName`, `Environment`, `AppServiceName`).

---

## Stack Details

### `aws-vpc-stack.yml` (product-level, deploy once)
**Parameters:** `ProductName`, `Environment`, `VpcCidr` (default `10.0.0.0/16`), `PublicSubnetACidr` (default `10.0.0.0/24`), `PublicSubnetBCidr` (default `10.0.1.0/24`), `PrivateSubnetACidr` (default `10.0.10.0/24`), `PrivateSubnetBCidr` (default `10.0.11.0/24`), `ContainerPort` (default `8080`).

**Creates:**
- VPC (`10.0.0.0/16`), Internet Gateway
- 2 public subnets (ALB + NAT, across 2 AZs) — `MapPublicIpOnLaunch: true`
- 2 private subnets (Fargate tasks, across 2 AZs) — `MapPublicIpOnLaunch: false`
- Single NAT Gateway in Public Subnet A (cost-optimised, one AZ)
- Public route table → IGW; Private route table → NAT Gateway
- `sg-alb` — inbound TCP :80 from `0.0.0.0/0`
- `sg-ecs` — inbound `ContainerPort` from `sg-alb` only
- `sg-rds` — inbound TCP :5432 from `sg-ecs` only (Aurora PostgreSQL)

**Exports (prefix `${Environment}-${ProductName}`):**
`-vpc-id`, `-public-subnet-a`, `-public-subnet-b`, `-private-subnet-a`, `-private-subnet-b`, `-sg-alb-id`, `-sg-ecs-id`, `-sg-rds-id`

**Tags on every resource:** `ProductName`, `Environment`, `ManagedBy=cloudformation`

---

### `aws-ecs-infra-stack.yml` (product-level, deploy once)
**Parameters:** `ProductName`, `Environment`.

**Creates:**
- ECS Cluster: `${Environment}-${ProductName}-cluster`
- ALB (internet-facing, HTTP :80): `${Environment}-${ProductName}-alb` — subnets and security group imported from VPC stack
- ALB Listener (HTTP :80): default action = `fixed-response 404 {"error":"not found"}` — each per-service stack adds its own `ListenerRule`

**Exports (prefix `${Environment}-${ProductName}`):**
`-ecs-cluster-name`, `-ecs-cluster-arn`, `-alb-arn`, `-alb-listener-arn`, `-alb-dns`

---

### `per-service/aws-codebuild-stack.yml` (per microservice, deploy once)
**Parameters:** `ProductName`, `AwsAccountId`, `Environment`, `AppServiceName`, `GitHubOwner`, `GitHubRepo`, `GitHubBranch` (default `main`), `GitHubConnectionArn`, `BuildSpecFile` (default `buildspec.yml`), `ImageTag` (default `latest`), `ComputeType` (default `BUILD_GENERAL1_SMALL`), `BuildTimeoutMinutes` (default `30`), `LogRetentionDays` (default `30`).

**Creates:**
- ECR repository: `${Environment}-${ProductName}-${AppServiceName}-repo` (`ImageTagMutability: IMMUTABLE`, `ScanOnPush: true`)
- CloudWatch Log Group: `/aws/codebuild/${Environment}-${ProductName}-${AppServiceName}-codebuild`
- CodeBuild IAM role with policies: ECR push, CloudWatch Logs, S3 artifacts, CodeConnections, CodeBuild Reports
- CodeBuild project: GitHub source (CODECONNECTIONS auth), `PrivilegedMode: true`, Docker layer + source cache, `LINUX_CONTAINER`, `standard:7.0`, `LINUX_KERNEL_6`
- Environment variables injected at build time: `AWS_DEFAULT_REGION`, `AWS_ACCOUNT_ID`, `ECR_REPO`, `IMAGE_TAG`

**Exports:** `-ecr-repository-uri`, `-codebuild-project-name`, `-codebuild-project-arn`, `-codebuild-service-role-arn`, `-codebuild-log-group-name`

---

### `per-service/aws-iam-stack.yml` (per microservice, deploy once)
**Parameters:** `ProductName`, `Environment`, `AppServiceName`.

**Creates:**
- `EcsTaskExecutionRole` — `AmazonECSTaskExecutionRolePolicy` managed policy (ECR pull + CloudWatch Logs)
- `EcsTaskRole` — inline policies:
  - CloudWatch Logs: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` scoped to `/ecs/${Environment}-${ProductName}-${AppServiceName}*`
  - Secrets Manager: `secretsmanager:GetSecretValue` scoped to `${Environment}-${ProductName}-${AppServiceName}-db-secret*` (allows the task to read the Aurora password)
- **No EC2 instance role or instance profile** (Fargate only)

**Role naming:** `${Environment}-${ProductName}-${AppServiceName}-ecs-task-execution-role` / `-ecs-task-role`

**Exports:** `${Environment}-${ProductName}-${AppServiceName}-ecs-task-execution-role-arn`, `-ecs-task-role-arn`

---

### `per-service/aws-rds-aurora-stack.yml` (per microservice, deploy once)
**Parameters:** `ProductName`, `Environment`, `AppServiceName`, `DbName` (default `appdb`), `DbInstanceClass` (default `db.t3.medium`), `AuroraEngineVersion` (default `15.4`), `BackupRetentionDays` (default `7`), `DeletionProtection` (default `false` for dev, `true` for prod).

**Creates:**
- **Secrets Manager secret:** `${Environment}-${ProductName}-${AppServiceName}-db-secret` — stores `{ "username": "appuser", "password": "<auto-generated>" }` using `GenerateSecretString`. The ECS task reads this secret at runtime; the password is **never stored in SSM or CloudFormation parameters**.
- **DB Subnet Group** — covers both private subnets (imported from VPC stack); named `${Environment}-${ProductName}-${AppServiceName}-subnet-group`.
- **Aurora PostgreSQL Cluster** (`AWS::RDS::DBCluster`):
  - Engine: `aurora-postgresql`, version from `AuroraEngineVersion`
  - Cluster identifier: `${Environment}-${ProductName}-${AppServiceName}-cluster`
  - Database name: `DbName`
  - Master credentials: resolved from the Secrets Manager secret via `ManageMasterUserPassword: true` (Aurora native integration — no plaintext password in the template)
  - VPC security group: `sg-rds` imported from VPC stack
  - Subnet group: created above
  - `StorageEncrypted: true` — always enabled
  - `BackupRetentionPeriod`: from `BackupRetentionDays`
  - `DeletionProtection`: from `DeletionProtection` parameter
  - `UpdateReplacePolicy: Snapshot`, `DeletionPolicy: Snapshot` — prevents accidental data loss
- **Aurora Writer Instance** (`AWS::RDS::DBInstance`):
  - Instance identifier: `${Environment}-${ProductName}-${AppServiceName}-instance-1`
  - `DBInstanceClass`: from `DbInstanceClass`
  - `PromotionTier: 0` (writer)

**Exports:** `${Environment}-${ProductName}-${AppServiceName}-db-endpoint`, `-db-port`, `-db-name`, `-db-secret-arn`

**Cross-stack imports consumed:**
- VPC: `private-subnet-a/b`, `sg-rds-id`

---

### `per-service/aws-ecs-service-stack.yml` (per microservice, deploy once)
**Parameters:** `ProductName`, `Environment`, `AppServiceName`, `ContainerPort` (default `8080`), `HealthCheckPath` (default `/actuator/health`), `HealthCheckIntervalSeconds` (default `30`), `HealthCheckTimeoutSeconds` (default `5`), `HealthyThresholdCount` (default `2`), `UnhealthyThresholdCount` (default `3`), `ListenerRulePriority`, `TaskCpu` (default `512`, allowed: `256/512/1024/2048/4096`), `TaskMemory` (default `1024`), `DesiredCount` (default `0`), `LogRetentionDays` (default `7`).

**Creates:**
- CloudWatch Log Group: `/ecs/${Environment}-${ProductName}-${AppServiceName}` (tags include `AppServiceName`)
- Task Definition (`UpdateReplacePolicy: Retain`, `DeletionPolicy: Retain`):
  - `NetworkMode: awsvpc`, `RequiresCompatibilities: [FARGATE]`
  - CPU/Memory at task level (Fargate requirement)
  - Image: `${EcrRepoUri}:{{resolve:ssm:/${Environment}-${ProductName}-${AppServiceName}-imageTag}}` (dynamic SSM resolution)
  - `ExecutionRoleArn` / `TaskRoleArn` imported from IAM stack
  - Container env vars: `SPRING_PROFILES_ACTIVE=${Environment}`, `SERVER_PORT=${ContainerPort}`, `DB_HOST` (from RDS stack export), `DB_PORT` (from RDS stack export), `DB_NAME` (from RDS stack export)
  - `DB_SECRET_ARN` injected as an environment variable; the application reads the secret at startup via the AWS SDK to obtain the username and password — **never inject the password as a plaintext env var**
  - Log driver: `awslogs` → the log group above
- ALB Target Group: `TargetType: ip` (required for Fargate `awsvpc`), health check configured from parameters
- ALB Listener Rule: path-pattern `/${AppServiceName}/*` → forwards to the Target Group; `Priority: ${ListenerRulePriority}`
- ECS Service: `LaunchType: FARGATE`, `AssignPublicIp: DISABLED`, private subnets, `HealthCheckGracePeriodSeconds: 60`, deployment circuit breaker with `Rollback: true`, `MinimumHealthyPercent: 50`, `MaximumPercent: 200`

**Exports:** `${Environment}-${ProductName}-${AppServiceName}-ecs-service-name`

**Cross-stack imports consumed:**
- VPC: `vpc-id`, `private-subnet-a/b`, `sg-ecs-id`
- IAM: `ecs-task-execution-role-arn`, `ecs-task-role-arn`
- Infra: `ecs-cluster-arn`, `alb-listener-arn`
- CodeBuild: `ecr-repository-uri`
- RDS Aurora: `db-endpoint`, `db-port`, `db-name`, `db-secret-arn`

---

## Deployment Order

### Product-level (once per product × environment)
```
[1] aws-vpc-stack.yml        → stack-name: ${Environment}-${ProductName}-vpc
[2] aws-ecs-infra-stack.yml  → stack-name: ${Environment}-${ProductName}-ecs-infra
```

### Per-service (once per component × environment)
```
[3] per-service/aws-codebuild-stack.yml   → stack-name: ${Environment}-${ProductName}-${AppServiceName}-codebuild
[4] (manual) aws ssm put-parameter /${Environment}-${ProductName}-${AppServiceName}-imageTag
[5] per-service/aws-iam-stack.yml         → stack-name: ${Environment}-${ProductName}-${AppServiceName}-iam
[6] per-service/aws-rds-aurora-stack.yml  → stack-name: ${Environment}-${ProductName}-${AppServiceName}-rds
[7] per-service/aws-ecs-service-stack.yml → stack-name: ${Environment}-${ProductName}-${AppServiceName}-ecs-service
[8] (manual) aws ecs update-service --desired-count N --force-new-deployment   ← starts tasks
```

### Teardown order (reverse)
```
[1] ${AppServiceName}-ecs-service
[2] ${AppServiceName}-rds          ← DeletionPolicy: Snapshot — a final snapshot is created automatically
[3] ${AppServiceName}-iam
[4] ${AppServiceName}-codebuild
[5] ${ProductName}-ecs-infra
[6] ${ProductName}-vpc
```

---

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

# [2] ECS Infra (Cluster + ALB)
aws cloudformation deploy \
  --template-file cloudFormation/generic/aws-ecs-infra-stack.yml \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-ecs-infra" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    ProductName="${PRODUCT_NAME}" \
    Environment="${ENVIRONMENT}"
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

# [5] IAM roles
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

# [7] ECS Service (Task Definition + Service + ALB Rule)
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

## Useful Operations Commands

```bash
# Check ALB DNS name
aws cloudformation describe-stacks \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-ecs-infra" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='AlbDnsName'].OutputValue" \
  --output text

# List ECR images
aws ecr describe-images \
  --repository-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-repo" \
  --region "${AWS_REGION}" \
  --query 'sort_by(imageDetails,& imagePushedAt)[*].[imageTags[0],imagePushedAt]' \
  --output table

# List task definition revisions
aws ecs list-task-definitions \
  --family-prefix "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-task" \
  --region "${AWS_REGION}" \
  --sort DESC

# Rollback to a specific task definition revision
aws ecs update-service \
  --cluster "${ENVIRONMENT}-${PRODUCT_NAME}-cluster" \
  --service "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-service" \
  --task-definition "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-task:5" \
  --force-new-deployment \
  --region "${AWS_REGION}"

# Update stack with new DesiredCount (CloudFormation way)
aws cloudformation update-stack \
  --stack-name "${ENVIRONMENT}-${PRODUCT_NAME}-${APP_SERVICE_NAME}-ecs-service" \
  --use-previous-template \
  --parameters \
    ParameterKey=ProductName,UsePreviousValue=true \
    ParameterKey=Environment,UsePreviousValue=true \
    ParameterKey=AppServiceName,UsePreviousValue=true \
    ParameterKey=ContainerPort,UsePreviousValue=true \
    ParameterKey=HealthCheckPath,UsePreviousValue=true \
    ParameterKey=ListenerRulePriority,UsePreviousValue=true \
    ParameterKey=TaskCpu,UsePreviousValue=true \
    ParameterKey=TaskMemory,UsePreviousValue=true \
    ParameterKey=LogRetentionDays,UsePreviousValue=true \
    ParameterKey=DesiredCount,ParameterValue=3 \
  --region "${AWS_REGION}"
```

---

## Conventions & Patterns

- **Resource naming:** `${Environment}-${ProductName}` (product-level) or `${Environment}-${ProductName}-${AppServiceName}` (per-service)
- **Stack naming:** `${Environment}-${ProductName}-<tier>` e.g. `dev-webstore-vpc`, `dev-webstore-catalog-ecs-service`
- **Tags on every resource:** `ProductName`, `Environment`, `ManagedBy=cloudformation`; per-service resources also add `AppServiceName`
- **Cross-stack references:** always via `Fn::ImportValue` / `Outputs.Export` — never copy-paste ARNs between stacks
- **Sensitive values:** never hardcoded — use SSM Parameter Store (image tags) or Secrets Manager (credentials)
- **`ENVIRONMENT`, `AWS_REGION`, `AWS_ACCOUNT_ID`:** always shell environment variables — never hardcoded in scripts
- **Task Definition immutability:** `UpdateReplacePolicy: Retain` + `DeletionPolicy: Retain` — old revisions are preserved for rollback
- **Allowed Environments:** `dev`, `staging`, `prod` — enforced via `AllowedValues` in every template

---

## How to use this skill

1. **Ask for mandatory inputs** (`PRODUCT_NAME`, `APP_SERVICE_NAME`, `LISTENER_RULE_PRIORITY`, `GITHUB_*`) before generating any code.
2. Substitute every `<PRODUCT_NAME>`, `<APP_SERVICE_NAME>`, `<CONTAINER_PORT>`, `<HEALTH_CHECK_PATH>`, `<LISTENER_RULE_PRIORITY>`, `<GITHUB_*>` placeholder in all generated stacks and scripts.
3. `ENVIRONMENT`, `AWS_REGION`, `AWS_ACCOUNT_ID` are **shell variables** — keep them as `${VARIABLE_NAME}` in all scripts.
4. When generating multiple microservices, each gets its own `per-service/` stack trio with a **unique `ListenerRulePriority`**.
5. **Never hardcode `DesiredCount > 0`** in CloudFormation — start tasks via `aws ecs update-service` after the stack is deployed.
6. **Do not generate an ECR-only stack** — ECR is created inside `aws-codebuild-stack.yml` alongside the CodeBuild project.
7. Place generic templates in `cloudFormation/generic/` and per-service templates in `cloudFormation/generic/per-service/`.
8. Always add the `--capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND` flag to every `aws cloudformation deploy` call.
9. Generate `aws-rds-aurora-stack.yml` with `ManageMasterUserPassword: true` — never put the database password in plaintext in any CloudFormation parameter or environment variable.
10. Inject `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_SECRET_ARN` into the ECS task as environment variables; the application reads the secret at startup via the AWS SDK.
11. Add `sg-rds` to `aws-vpc-stack.yml` — only inbound TCP :5432 from `sg-ecs`.
12. Include a Secrets Manager `GetSecretValue` policy on the DB secret ARN in `EcsTaskRole` inside `aws-iam-stack.yml`.
13. Respond and assist in English unless the user requests another language.
14. Await further instructions and execute them accordingly.
