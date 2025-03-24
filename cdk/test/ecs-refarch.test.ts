import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsRefarchStack } from '../lib/ecs-refarch-stack';

describe('EcsRefarchStack', () => {
  const app = new cdk.App();
  
  // Development environment test
  const devStack = new EcsRefarchStack(app, 'EcsRefarchDevTest', {
    env: { account: '123456789012', region: 'us-east-1' },
    environmentType: 'development',
    environmentConfig: {
      instanceType: 't4g.medium',
      clusterSize: 2,
      fargateTaskCpu: 256,
      fargateTaskMemory: 512
    }
  });
  const devTemplate = Template.fromStack(devStack);

  // Production environment test
  const prodStack = new EcsRefarchStack(app, 'EcsRefarchProdTest', {
    env: { account: '123456789012', region: 'us-east-1' },
    environmentType: 'production',
    environmentConfig: {
      instanceType: 'm6g.large',
      clusterSize: 4,
      fargateTaskCpu: 512,
      fargateTaskMemory: 1024
    }
  });
  const prodTemplate = Template.fromStack(prodStack);

  test('VPC Created', () => {
    devTemplate.resourceCountIs('AWS::EC2::VPC', 1);
    devTemplate.resourceCountIs('AWS::EC2::Subnet', 4); // 2 public, 2 private
    devTemplate.resourceCountIs('AWS::EC2::NatGateway', 2);
  });

  test('ECS Cluster Created', () => {
    devTemplate.resourceCountIs('AWS::ECS::Cluster', 1);
  });

  test('Auto Scaling Group Created with Graviton Instance Type', () => {
    devTemplate.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
      MixedInstancesPolicy: {
        LaunchTemplate: {
          Overrides: [
            { InstanceType: 't4g.medium' },
            { InstanceType: 'c6g.large' },
            { InstanceType: 'r6g.large' }
          ]
        }
      }
    });
    
    prodTemplate.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
      MixedInstancesPolicy: {
        LaunchTemplate: {
          Overrides: [
            { InstanceType: 'm6g.large' },
            { InstanceType: 'c6g.large' },
            { InstanceType: 'r6g.large' }
          ]
        }
      }
    });
  });

  test('Fargate Task Definition Created with ARM64 Architecture', () => {
    devTemplate.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RuntimePlatform: {
        CpuArchitecture: 'ARM64',
        OperatingSystemFamily: 'LINUX'
      }
    });
  });

  test('ALB Created with Listener Rules', () => {
    devTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    devTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
    devTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::ListenerRule', 2);
  });

  test('ECS Services Created', () => {
    devTemplate.resourceCountIs('AWS::ECS::Service', 2);
  });

  test('CloudWatch Logs Groups Created', () => {
    devTemplate.resourceCountIs('AWS::Logs::LogGroup', 3); // VPC Flow Logs + 2 service log groups
  });

  test('Security Groups Created', () => {
    devTemplate.resourceCountIs('AWS::EC2::SecurityGroup', 3); // ALB, ECS hosts, Fargate tasks
  });

  test('Outputs Created', () => {
    devTemplate.hasOutput('Architecture', {
      Value: 'ARM64'
    });
    
    devTemplate.hasOutput('ClusterName', {});
    devTemplate.hasOutput('LoadBalancerDNS', {});
    devTemplate.hasOutput('ProductServiceUrl', {});
    devTemplate.hasOutput('WebsiteServiceUrl', {});
  });
});
