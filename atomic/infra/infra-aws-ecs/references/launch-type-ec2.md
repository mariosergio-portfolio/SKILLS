# infra-aws-ecs — EC2 launch type

Reference file for the `infra-aws-ecs` skill. Read it **only** when `LAUNCH_TYPE=EC2`. It lists everything that differs from the shared stacks in [stack-details.md](stack-details.md). Anything not listed here is the same as Fargate.

Pick EC2 when you need host-level control, custom AMIs, or sustained high throughput, or want to pack several tasks onto one instance. You pay per instance whatever the task count, which makes EC2 cheaper than Fargate at high, steady utilisation.

## Extra sizing parameters

| Resource | CloudFormation Parameter | Test/Dev (default) | Prod (minimum) |
|---|---|---|---|
| **EC2 instance type** | `InstanceType` | `t3.medium` ⚠️ a JVM needs at least 4 GB RAM; smaller instance types will run out of memory | `t3.large` |
| **EC2 root EBS volume** | `EbsVolumeSize` | `20 GB` gp3 | `30 GB` gp3 |
| **ASG min / desired / max** | `AsgMinSize` / `AsgDesiredSize` / `AsgMaxSize` | `1` / `1` / `1` | `2` / `3` / `6` |
| **Task memory** | `TaskMemory` | `768 MB` ⚠️ lower than Fargate because `bridge` mode shares headroom with the OS | `2048 MB` |

## Stack differences

### `aws-ecs-infra-stack.yml`
**Extra parameters:** `InstanceType` (default `t3.medium`), `EbsVolumeSize` (default `20`), `AsgMinSize` (default `1`), `AsgDesiredSize` (default `1`), `AsgMaxSize` (default `1`).

**Extra resources:**
- **Launch Template:** the Amazon Linux 2023 ECS-optimised AMI (resolved via SSM from `/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id`), `InstanceType`, a gp3 EBS volume, and the EC2 instance profile imported from the IAM stack. `UserData` injects the ECS cluster name so instances register with the cluster.
- **Auto Scaling Group:** in the private subnets, sized by `MinSize` / `DesiredCapacity` / `MaxSize` from the parameters. Name: `${Environment}-${ProductName}-asg`.
- **ECS Capacity Provider:** backed by the ASG, with managed scaling targeting `80%`.

### `per-service/aws-iam-stack.yml`
**Extra resources:**
- **`Ec2InstanceRole`** has the `AmazonEC2ContainerServiceforEC2Role` and `AmazonSSMManagedInstanceCore` managed policies, so instances can register with the ECS cluster.
- **`Ec2InstanceProfile`** wraps `Ec2InstanceRole` and is attached to the launch template.

**Extra naming / export:** `${Environment}-${ProductName}-${AppServiceName}-ec2-instance-role`, export `-ec2-instance-profile-arn`.

### `per-service/aws-ecs-service-stack.yml`
- Task Definition: **`NetworkMode: bridge`** (lets several tasks share one instance, each on a dynamic host port) and **`RequiresCompatibilities: [EC2]`**.
- Port mapping: **host port `0`** maps to `ContainerPort`. Dynamic ports are required for `TargetType: instance`.
- ALB Target Group: **`TargetType: instance`**.
- ECS Service: **`LaunchType: EC2`**. `AssignPublicIp` does not apply in bridge mode.

## Deploy script — step [2] parameters

```bash
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

## Operations — scale the hosts

```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name "${ENVIRONMENT}-${PRODUCT_NAME}-asg" \
  --min-size 2 \
  --desired-capacity 3 \
  --max-size 6 \
  --region "${AWS_REGION}"
```

Scale the hosts before raising a service's `DesiredCount` beyond what the current instances can hold.
