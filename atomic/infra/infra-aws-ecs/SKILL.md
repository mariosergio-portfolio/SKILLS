---
name: infra-aws-ecs
description: AWS implementation of infra-iac-specification using CloudFormation and ECS (EC2 or Fargate launch type): VPC, shared ALB, per-service ECS services, Aurora PostgreSQL, CodeBuild + ECR CI/CD, SSM-driven image tags, GitHub CodeConnections, deploy scripts and operations. Use when deploying this architecture to AWS or writing its CloudFormation stacks.
---

# AWS Full-Stack Deployment — ECS on EC2 or Fargate (CloudFormation IaC)

## Scope

**This skill is a provider implementation of `infra-iac-specification`** — it realises every contract defined in that specification using AWS CloudFormation, ECS, Aurora PostgreSQL, and CodeBuild.

## Choose the launch type first

Ask the user which ECS launch type to use when they have not said, then read **only** the matching file. It lists every stack, parameter and command that differs; everything else in this skill applies to both.

| | Fargate (default for dev/test) | EC2 |
|---|---|---|
| Pick it when | Variable or low load, no hosts to manage | Steady high load, host-level control, custom AMIs, packing many tasks per host |
| Cost model | Per task vCPU/memory (≈ $11.50/month for a 0.5 vCPU / 1 GB task) | Per instance, whatever the task count (≈ $30/month for one `t3.medium`) |
| Networking | `awsvpc`, target type `ip` | `bridge`, dynamic host port, target type `instance` |
| Extra resources | none | Launch template, Auto Scaling group, capacity provider, EC2 instance role |
| Details | [references/launch-type-fargate.md](references/launch-type-fargate.md) | [references/launch-type-ec2.md](references/launch-type-ec2.md) |

---

## Architecture Model: Product + Services (Multi-Microservice)

The real stack layout is **two-tier**:

1. **Product-level infrastructure** (deployed once per product per environment):
   - VPC, subnets, security groups, NAT Gateway → `aws-vpc-stack.yml`
   - Shared ECS Cluster + ALB (HTTP :80 with default 404 action), plus the EC2 capacity (ASG + capacity provider) when using EC2 → `aws-ecs-infra-stack.yml`

2. **Per-service infrastructure** (deployed once per microservice per environment — all stacks under `per-service/`):
   - CodeBuild project + ECR repository → `aws-codebuild-stack.yml`
   - IAM roles (task execution + task, plus the EC2 instance role/profile when using EC2) → `aws-iam-stack.yml`
   - **RDS Aurora cluster (PostgreSQL-compatible)** → `aws-rds-aurora-stack.yml`
   - ECS Task Definition + ECS Service + ALB Listener Rule + Target Group → `aws-ecs-service-stack.yml`

Multiple microservices (e.g. `catalog`, `orders`, `payments`) share the same VPC, ECS Cluster, and ALB. Each gets its own ALB path-based rule: `/<AppServiceName>/*`.

```
Internet
    │
    └──► ALB (internet-facing, HTTP :80)
              │
              ├── /catalog/*   → ECS Service (catalog)
              ├── /orders/*    → ECS Service (orders)
              └── /payments/*  → ECS Service (payments)
                       │
              (private subnets, outbound via NAT; Fargate tasks or EC2 ASG hosts)
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
| **Task memory** | `TaskMemory` | `1024 MB` Fargate / `768 MB` EC2 | `2048 MB` |
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

EC2 hosts add instance type, EBS and ASG size parameters — see [references/launch-type-ec2.md](references/launch-type-ec2.md).

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
| `LAUNCH_TYPE` | `FARGATE` or `EC2` | ⚠️ **Yes** | `FARGATE` |

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
│   ├── aws-ecs-infra-stack.yml        ← ECS Cluster + ALB (+ ASG + capacity provider for EC2) (once per product)
│   └── per-service/
│       ├── aws-codebuild-stack.yml    ← ECR repo + CodeBuild project (once per microservice)
│       ├── aws-iam-stack.yml          ← task execution role + task role (+ EC2 instance role/profile) (once per microservice)
│       ├── aws-rds-aurora-stack.yml   ← Aurora PostgreSQL cluster + subnet group + secret (once per microservice)
│       └── aws-ecs-service-stack.yml  ← Task definition, ECS service, ALB rule, TG (once per microservice)
```

> All templates are **generic** — no product-specific values are hardcoded. Everything is driven by parameters (`ProductName`, `Environment`, `AppServiceName`).

---

## Stack Details

Details: [references/stack-details.md](references/stack-details.md). Read it when writing or reviewing any individual CloudFormation stack template, together with the launch-type file ([references/launch-type-ec2.md](references/launch-type-ec2.md) / [references/launch-type-fargate.md](references/launch-type-fargate.md)).

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

Details: [references/deploy-script.md](references/deploy-script.md). Read it when writing the deploy script.

## Useful Operations Commands

Details: [references/operations.md](references/operations.md). Read it when operating, debugging, or scaling a running environment.

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
1. **Ask for mandatory inputs** (`LAUNCH_TYPE`, `PRODUCT_NAME`, `APP_SERVICE_NAME`, `LISTENER_RULE_PRIORITY`, `GITHUB_*`) before generating any code, then read the matching launch-type file.
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
13. Apply every launch-type-specific rule from the launch-type file (network mode, target type, host port, extra EC2 resources) — never mix the two.
