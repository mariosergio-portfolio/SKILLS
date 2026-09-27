---
description: Create or change the AWS CloudFormation + ECS infrastructure for a service
argument-hint: <service and goal, e.g. "catalog service on Fargate, dev">
---
@C:/dev/source/skills/atomic/infra/infra-iac-specification/SKILL.md
@C:/dev/source/skills/atomic/infra/infra-aws-ecs/SKILL.md

Task: $ARGUMENTS

Follow infra-aws-ecs above. Ask for the mandatory inputs (including the launch type) before generating anything, then read only the matching launch-type file in `C:/dev/source/skills/atomic/infra/infra-aws-ecs/references/`.
