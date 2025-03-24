#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcsRefarchStack } from '../lib/ecs-refarch-stack';

const app = new cdk.App();

// Environment-specific configurations
const environments = {
  development: {
    instanceType: 't4g.medium',
    clusterSize: 2,
    fargateTaskCpu: 256,
    fargateTaskMemory: 512
  },
  production: {
    instanceType: 'm6g.large',
    clusterSize: 4,
    fargateTaskCpu: 512,
    fargateTaskMemory: 1024
  }
};

// Deploy development stack
new EcsRefarchStack(app, 'EcsRefarchDev', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  environmentType: 'development',
  environmentConfig: environments.development,
  description: 'ECS Reference Architecture with Graviton (Development)'
});

// Deploy production stack
new EcsRefarchStack(app, 'EcsRefarchProd', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  environmentType: 'production',
  environmentConfig: environments.production,
  description: 'ECS Reference Architecture with Graviton (Production)'
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'EcsRefarch');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
