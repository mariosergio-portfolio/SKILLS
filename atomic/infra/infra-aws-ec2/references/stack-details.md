# infra-aws-ec2 — CloudFormation stack details

Reference file for the `infra-aws-ec2` skill. Read it when writing or reviewing any individual CloudFormation stack template.

## Stack Details

### `aws-vpc-stack.yml` (product-level, deploy once)
**Parameters:** `ProductName`, `Environment`, `VpcCidr` (default `10.0.0.0/16`), `PublicSubnetACidr` (default `10.0.0.0/24`), `PublicSubnetBCidr` (default `10.0.1.0/24`), `PrivateSubnetACidr` (default `10.0.10.0/24`), `PrivateSubnetBCidr` (default `10.0.11.0/24`), `ContainerPort` (default `8080`).

**Creates:**
- VPC (`10.0.0.0/16`), Internet Gateway
- 2 public subnets (ALB + NAT, across 2 AZs) — `MapPublicIpOnLaunch: true`
- 2 private subnets (EC2 container instances + tasks, across 2 AZs) — `MapPublicIpOnLaunch: false`
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
**Parameters:** `ProductName`, `Environment`, `InstanceType` (default `t3.medium`), `EbsVolumeSize` (default `20`), `AsgMinSize` (default `1`), `AsgDesiredSize` (default `1`), `AsgMaxSize` (default `1`).

**Creates:**
- ECS Cluster: `${Environment}-${ProductName}-cluster`
- **Launch Template** — Amazon Linux 2023 ECS-optimised AMI (resolved via SSM: `/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id`), `InstanceType`, gp3 EBS, EC2 instance profile (imported from IAM stack), ECS cluster name injected via `UserData`
- **Auto Scaling Group** — private subnets, `MinSize/DesiredCapacity/MaxSize` from parameters
- **ECS Capacity Provider** — backed by the ASG, managed scaling target `80%`
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
- **`Ec2InstanceRole`** — `AmazonEC2ContainerServiceforEC2Role` + `AmazonSSMManagedInstanceCore` managed policies, allowing EC2 instances to register with the ECS cluster
- **`Ec2InstanceProfile`** — wraps `Ec2InstanceRole`; attached to the Launch Template in `aws-ecs-infra-stack.yml`

**Role naming:** `${Environment}-${ProductName}-${AppServiceName}-ecs-task-execution-role` / `-ecs-task-role` / `-ec2-instance-role`

**Exports:** `${Environment}-${ProductName}-${AppServiceName}-ecs-task-execution-role-arn`, `-ecs-task-role-arn`, `-ec2-instance-profile-arn`

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
**Parameters:** `ProductName`, `Environment`, `AppServiceName`, `ContainerPort` (default `8080`), `HealthCheckPath` (default `/actuator/health`), `HealthCheckIntervalSeconds` (default `30`), `HealthCheckTimeoutSeconds` (default `5`), `HealthyThresholdCount` (default `2`), `UnhealthyThresholdCount` (default `3`), `ListenerRulePriority`, `TaskCpu` (default `512`, allowed: `256/512/1024/2048/4096`), `TaskMemory` (default `768`), `DesiredCount` (default `0`), `LogRetentionDays` (default `7`).

**Creates:**
- CloudWatch Log Group: `/ecs/${Environment}-${ProductName}-${AppServiceName}` (tags include `AppServiceName`)
- Task Definition (`UpdateReplacePolicy: Retain`, `DeletionPolicy: Retain`):
  - **`NetworkMode: bridge`** (EC2 — allows multiple tasks per instance with dynamic host-port mapping)
  - **`RequiresCompatibilities: [EC2]`**
  - CPU/Memory at task level
  - Image: `${EcrRepoUri}:{{resolve:ssm:/${Environment}-${ProductName}-${AppServiceName}-imageTag}}` (dynamic SSM resolution)
  - `ExecutionRoleArn` / `TaskRoleArn` imported from IAM stack
  - **Host port `0`** → container port `ContainerPort` (dynamic port assignment; required for `TargetType: instance`)
  - Container env vars: `SPRING_PROFILES_ACTIVE=${Environment}`, `SERVER_PORT=${ContainerPort}`, `DB_HOST` (from RDS stack export), `DB_PORT` (from RDS stack export), `DB_NAME` (from RDS stack export)
  - `DB_SECRET_ARN` injected as an environment variable; the application reads the secret at startup via the AWS SDK to obtain the username and password — **never inject the password as a plaintext env var**
  - Log driver: `awslogs` → the log group above
- ALB Target Group: **`TargetType: instance`** (required for EC2 `bridge` network mode), health check configured from parameters
- ALB Listener Rule: path-pattern `/${AppServiceName}/*` → forwards to the Target Group; `Priority: ${ListenerRulePriority}`
- ECS Service: **`LaunchType: EC2`**, `HealthCheckGracePeriodSeconds: 60`, deployment circuit breaker with `Rollback: true`, `MinimumHealthyPercent: 50`, `MaximumPercent: 200`

**Exports:** `${Environment}-${ProductName}-${AppServiceName}-ecs-service-name`

**Cross-stack imports consumed:**
- VPC: `vpc-id`, `private-subnet-a/b`, `sg-ecs-id`
- IAM: `ecs-task-execution-role-arn`, `ecs-task-role-arn`
- Infra: `ecs-cluster-arn`, `alb-listener-arn`
- CodeBuild: `ecr-repository-uri`
- RDS Aurora: `db-endpoint`, `db-port`, `db-name`, `db-secret-arn`

---
