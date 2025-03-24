# ECS Reference Architecture with AWS CDK

This directory contains an AWS CDK implementation of the ECS Reference Architecture, using Graviton processors for better cost efficiency and energy savings.

## Architecture Overview

The CDK code deploys the same architecture as the CloudFormation templates, but with improved type safety, reusable components, and modern best practices:

- VPC with public and private subnets across two Availability Zones
- ECS Cluster with both EC2 and Fargate capacity providers
- Graviton-based instances (ARM64) for better price/performance
- Application Load Balancer with path-based routing
- Two microservices:
  - Product Service running on Fargate with ARM64 architecture
  - Website Service running on EC2 with ARM64 architecture
- Auto Scaling for both services
- CloudWatch Logs and Container Insights
- Security groups and IAM roles with least privilege

## Prerequisites

- [Node.js](https://nodejs.org/) (>= 14.x)
- [AWS CDK](https://aws.amazon.com/cdk/) (>= 2.x)
- AWS CLI configured with appropriate credentials

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Bootstrap your AWS environment (if you haven't already):

```bash
cdk bootstrap
```

3. Deploy the stacks:

```bash
# Deploy development environment
cdk deploy EcsRefarchDev

# Deploy production environment
cdk deploy EcsRefarchProd

# Deploy both environments
cdk deploy --all
```

## Project Structure

- `bin/ecs-refarch.ts` - Entry point for CDK app
- `lib/ecs-refarch-stack.ts` - Main stack definition
- `test/ecs-refarch.test.ts` - Unit tests

## Environment Configuration

The CDK app defines two environments:

1. **Development**:
   - t4g.medium instances (Graviton2)
   - 2 instances in the cluster
   - 256 CPU units / 512 MB memory for Fargate tasks

2. **Production**:
   - m6g.large instances (Graviton2)
   - 4 instances in the cluster
   - 512 CPU units / 1024 MB memory for Fargate tasks

## Testing

Run the unit tests:

```bash
npm test
```

## Useful CDK Commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Benefits of Using CDK

1. **Type Safety**: TypeScript provides compile-time type checking
2. **Reusable Components**: Create constructs that can be reused across projects
3. **IDE Support**: Better developer experience with auto-completion and inline documentation
4. **Testing**: Built-in testing framework for infrastructure code
5. **Higher-Level Abstractions**: CDK provides higher-level abstractions than raw CloudFormation
6. **Escape Hatches**: Access to underlying CloudFormation resources when needed

## Graviton Benefits

This implementation uses AWS Graviton processors (ARM64) which provide:

- Up to 40% better price/performance compared to equivalent x86-based instances
- Up to 20% lower cost for the same performance
- Reduced carbon footprint with better energy efficiency
