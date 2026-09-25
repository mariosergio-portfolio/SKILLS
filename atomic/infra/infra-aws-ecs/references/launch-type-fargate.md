# infra-aws-ecs — Fargate launch type

Reference file for the `infra-aws-ecs` skill. Read it **only** when `LAUNCH_TYPE=FARGATE`. It lists the Fargate-specific settings of the shared stacks in [stack-details.md](stack-details.md).

Fargate has no idle host cost: you pay only for the vCPU and memory reserved by running tasks. A single `0.5 vCPU / 1024 MB` task costs about $0.016/hour (about $11.50/month). One `t3.medium` EC2 host costs about $30/month regardless of how many tasks it runs. That makes Fargate the default for dev/test and for variable load.

## Sizing

| Resource | CloudFormation Parameter | Test/Dev (default) | Prod (minimum) |
|---|---|---|---|
| **Task CPU** | `TaskCpu` | `512` (½ vCPU) | `1024` (1 vCPU) |
| **Task memory** | `TaskMemory` | `1024 MB` | `2048 MB` |

CPU and memory must be a valid Fargate combination (for example 256/512–2048, 512/1024–4096, 1024/2048–8192).

## Stack settings

### `aws-ecs-infra-stack.yml`
Only the cluster, ALB and listener. No hosts, ASG or capacity provider. Parameters: `ProductName` and `Environment`.

### `per-service/aws-iam-stack.yml`
Only the task execution role and the task role. **No** EC2 instance role or instance profile.

### `per-service/aws-ecs-service-stack.yml`
- Task Definition: **`NetworkMode: awsvpc`** and **`RequiresCompatibilities: [FARGATE]`**. CPU and memory are set at task level (required by Fargate).
- Port mapping: `ContainerPort` only (no host port in `awsvpc` mode).
- ALB Target Group: **`TargetType: ip`**.
- ECS Service: **`LaunchType: FARGATE`**, **`AssignPublicIp: DISABLED`**, private subnets, and security group `sg-ecs`.

## Deploy script

Step [2] passes only `ProductName` and `Environment`. The rest of [deploy-script.md](deploy-script.md) applies unchanged.
