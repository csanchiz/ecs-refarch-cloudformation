# Deploying Microservices with Amazon ECS, AWS CloudFormation, and an Application Load Balancer

This reference architecture provides a set of YAML templates for deploying microservices to [Amazon Elastic Container Service (Amazon ECS)](https://aws.amazon.com/ecs/) with [AWS CloudFormation](https://aws.amazon.com/cloudformation/).

## Overview

![infrastructure-overview](images/architecture-overview.png)

This repository contains a set of nested CloudFormation templates that deploy the following:

- A tiered [VPC](https://aws.amazon.com/vpc/) with public and private subnets, spanning two Availability Zones
- A highly available ECS cluster using both EC2 and Fargate launch types with Graviton processors
- [ECS Capacity Providers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cluster-capacity-providers.html) for EC2 and Fargate with auto-scaling capabilities
- A mix of On-Demand and Spot instances for cost optimization
- [VPC Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html) for AWS services to improve security and reduce data transfer costs
- A pair of [NAT Gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) (one in each zone) to handle outbound traffic
- Two example microservices deployed as [ECS services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html):
  - A product service running on AWS Fargate with ARM64 architecture
  - A website service running on EC2 container instances with ARM64 architecture
- An [Application Load Balancer (ALB)](https://aws.amazon.com/elasticloadbalancing/application-load-balancer/) with path-based routing
- Centralized container logging with [Amazon CloudWatch Logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
- [Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html) for monitoring and troubleshooting
- A [Lambda Function](https://aws.amazon.com/lambda/) and [Auto Scaling Lifecycle Hook](https://docs.aws.amazon.com/autoscaling/ec2/userguide/lifecycle-hooks.html) to drain tasks from container instances during scale-in events

## Cost Optimization with AWS Graviton

This reference architecture uses AWS Graviton-based instances which provide:

- Up to 40% better price/performance compared to equivalent x86-based instances
- Up to 20% lower cost for the same performance
- Reduced carbon footprint with better energy efficiency
- Native support for ARM64 architecture

The templates are configured to use:
- t4g.medium for development environments (replacing t3.medium)
- m6g.large for production environments (replacing m5.large)

When using this architecture, ensure your container images support the ARM64 architecture. Most popular container images now provide multi-architecture support through Docker manifests.

## Why use AWS CloudFormation with Amazon ECS?

Using CloudFormation to deploy and manage services with ECS has several benefits:

### Infrastructure-as-Code

Templates can be used repeatedly to create identical copies of the same stack. Templates are simple YAML-formatted text files that can be placed under source control, stored in S3, and shared between teams. With CloudFormation, you can see exactly which AWS resources make up your stack and maintain full control over them.

### Self-documenting

With CloudFormation, your template becomes your documentation. Want to see exactly what you have deployed? Just look at your template. If you keep it in source control, you can also track changes over time.

### Intelligent updating & rollback

CloudFormation handles the entire lifecycle of your infrastructure, including updates. During updates, you have fine-grained control over how changes are applied, using features like [change sets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html), [rolling update policies](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html), and [stack policies](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/protect-stack-resources.html).

## Template details

The templates below are included in this repository:

| Template | Description |
| --- | --- |
| [master-updated.yaml](master-updated.yaml) | This is the master template - deploy it to CloudFormation and it includes all of the others automatically. |
| [infrastructure/vpc-updated.yaml](infrastructure/vpc-updated.yaml) | This template deploys a VPC with public and private subnets, Internet and NAT gateways, and VPC endpoints for AWS services. |
| [infrastructure/security-groups-updated.yaml](infrastructure/security-groups-updated.yaml) | This template contains the security groups required by the entire stack. |
| [infrastructure/load-balancers-updated.yaml](infrastructure/load-balancers-updated.yaml) | This template deploys an ALB with enhanced security features and access logs. |
| [infrastructure/ecs-cluster-updated.yaml](infrastructure/ecs-cluster-updated.yaml) | This template deploys an ECS cluster with both EC2 and Fargate capacity providers using Graviton processors. |
| [infrastructure/lifecyclehook-updated.yaml](infrastructure/lifecyclehook-updated.yaml) | This template deploys a Lambda function and Auto Scaling Lifecycle Hook to drain tasks from container instances during termination. |
| [services/product-service/service-fargate.yaml](services/product-service/service-fargate.yaml) | This is an example of a containerized service running on AWS Fargate with ARM64 architecture. |
| [services/website-service/service-updated.yaml](services/website-service/service-updated.yaml) | This is an example of a containerized service running on EC2 container instances with ARM64 architecture. |

After the CloudFormation templates have been deployed, the [stack outputs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html) contain links to the load-balanced URLs for each of the deployed microservices.

## AWS CDK Implementation

This repository also includes an AWS CDK implementation of the same architecture in the `cdk` directory. The CDK implementation provides:

- TypeScript-based infrastructure as code
- Strong typing and compile-time error checking
- Better IDE support with auto-completion
- Reusable components
- Built-in testing framework

To use the CDK implementation:

```bash
cd cdk
npm install
npm run build
cdk deploy EcsRefarchDev  # For development environment
cdk deploy EcsRefarchProd  # For production environment
```

See the [CDK README](cdk/README.md) for more details.

## How do I...?

### Get started and deploy this into my AWS account

1. Clone this repository to your local machine
2. Upload the templates to an S3 bucket in your account
3. Deploy the master-updated.yaml template via the AWS CloudFormation console or AWS CLI

### Customize the templates

1. Fork this GitHub repository
2. Clone the forked repository to your local machine
3. Modify the templates according to your requirements
4. Upload them to an Amazon S3 bucket
5. Deploy the master-updated.yaml template, or update your existing stack

### Create a new ECS service

1. Push your container image to a registry (e.g., [Amazon ECR](https://aws.amazon.com/ecr/))
   - Make sure your image supports ARM64 architecture for Graviton compatibility
   - Consider using multi-architecture images for maximum flexibility
2. Copy one of the existing service templates (service-fargate.yaml for Fargate or service-updated.yaml for EC2)
3. Update the `ContainerImage` parameter to point to your container image
4. Adjust the CPU, memory, and other parameters as needed
5. Add the service to the master-updated.yaml template
6. Deploy or update your CloudFormation stack

### Setup centralized container logging

Container logging is already configured in the service templates. Logs are sent to CloudWatch Logs with a 30-day retention period. You can view the logs in the [CloudWatch Logs console](https://console.aws.amazon.com/cloudwatch/home?#logs:).

To use a different logging solution:

1. Modify the `LogConfiguration` section in the task definition
2. ECS supports various logging drivers including `awslogs`, `splunk`, `fluentd`, and others
3. Update the retention period by changing the `RetentionInDays` parameter in the `CloudWatchLogsGroup` resource

### Change the instance types for the ECS cluster

The instance types are defined in the `EnvironmentConfiguration` mapping in the master-updated.yaml template:

```yaml
Mappings:
  EnvironmentConfiguration:
    Development:
      InstanceType: t4g.medium    # Graviton2-based instance
      ClusterSize: 2
    Production:
      InstanceType: m6g.large     # Graviton2-based instance
      ClusterSize: 4
    SpotConfiguration:
      InstanceTypes:
        - c6g.large
        - r6g.large
        - t4g.large
```

You can modify these values or add additional environment types as needed. All instance types use Graviton processors for better price/performance and energy efficiency.

### Configure auto-scaling for ECS services

Auto-scaling is already configured for the services using target tracking scaling policies based on CPU utilization and request count. You can adjust the target values and scaling parameters in the service templates.

For more advanced scaling configurations:

1. Modify the `ScalableTarget` and scaling policy resources in the service templates
2. Add additional metrics or alarms for scaling
3. Implement scheduled scaling for predictable workloads

### Deploy multiple environments (e.g., dev, test, production)

Deploy multiple CloudFormation stacks from the same set of templates, using different stack names and parameters:

```bash
# Deploy development environment
aws cloudformation deploy \
  --template-file master-updated.yaml \
  --stack-name dev-ecs-microservices \
  --parameter-overrides EnvironmentType=Development

# Deploy production environment
aws cloudformation deploy \
  --template-file master-updated.yaml \
  --stack-name prod-ecs-microservices \
  --parameter-overrides EnvironmentType=Production
```

### Use AWS Fargate for all services

To use AWS Fargate exclusively:

1. Remove the EC2 capacity provider from the ECS cluster template
2. Convert all service templates to use the Fargate launch type
3. Update the default capacity provider strategy in the ECS cluster template

### Implement blue/green deployments

To implement blue/green deployments:

1. Use [AWS CodeDeploy](https://aws.amazon.com/codedeploy/) with ECS
2. Add a `DeploymentController` to your ECS service:

```yaml
Service:
  Type: AWS::ECS::Service
  Properties:
    DeploymentController:
      Type: CODE_DEPLOY
    # Other properties...
```

3. Create the necessary CodeDeploy resources (application, deployment group, etc.)

## Security best practices

This reference architecture implements several security best practices:

- **Network segmentation**: Resources are deployed in private subnets where possible
- **Least privilege**: IAM roles follow the principle of least privilege
- **Security groups**: Traffic is restricted between components
- **VPC endpoints**: AWS services can be accessed without traversing the internet
- **Container security**: Tasks use separate execution and task roles
- **Logging and monitoring**: Container logs and metrics are collected centrally

## Testing

The repository includes a comprehensive testing framework in the `tests` directory:

- Unit tests for validating CloudFormation templates
- Integration tests using TaskCat
- CloudFormation linting with cfn-lint

To run the tests:

```bash
./tests/run_tests.sh
```

See the [Testing README](tests/README.md) for more details.

## Contributing

Please [create a new GitHub issue](https://github.com/awslabs/ecs-refarch-cloudformation/issues/new) for any feature requests, bugs, or documentation improvements.

Where possible, please also [submit a pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/) for the change.

## License

Copyright 2011-2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

[http://aws.amazon.com/apache2.0/](http://aws.amazon.com/apache2.0/)

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
