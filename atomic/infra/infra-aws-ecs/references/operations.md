# infra-aws-ecs — Operations commands

Reference file for the `infra-aws-ecs` skill. EC2 host scaling is in [launch-type-ec2.md](launch-type-ec2.md). Read it when operating, debugging, or scaling a running environment.

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
