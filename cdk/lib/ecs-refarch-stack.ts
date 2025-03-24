import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface EnvironmentConfig {
  instanceType: string;
  clusterSize: number;
  fargateTaskCpu: number;
  fargateTaskMemory: number;
}

export interface EcsRefarchStackProps extends cdk.StackProps {
  environmentType: string;
  environmentConfig: EnvironmentConfig;
}

export class EcsRefarchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsRefarchStackProps) {
    super(scope, id, props);

    // VPC with public and private subnets across 2 AZs
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        }
      ],
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3
        }
      }
    });

    // Add VPC Flow Logs
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(
        new logs.LogGroup(this, 'VpcFlowLogsGroup', {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY
        })
      )
    });

    // Security Groups
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for the ALB',
      allowAllOutbound: false
    });
    
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );
    
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from anywhere'
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      description: 'Security group for the ECS hosts',
      allowAllOutbound: true
    });
    
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.allTcp(),
      'Allow all TCP traffic from ALB'
    );
    
    ecsSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.allTcp(),
      'Allow all TCP traffic between ECS hosts'
    );

    const fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSecurityGroup', {
      vpc,
      description: 'Security group for Fargate tasks',
      allowAllOutbound: true
    });
    
    fargateSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.allTcp(),
      'Allow all TCP traffic from ALB'
    );

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }
    });

    // ALB Listener
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found'
      })
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ECSCluster', {
      vpc,
      containerInsights: true,
      clusterName: `${id}-cluster`
    });

    // ECS Capacity Provider - EC2 with Graviton
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ECSAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType(props.environmentConfig.instanceType),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM),
      desiredCapacity: props.environmentConfig.clusterSize,
      minCapacity: props.environmentConfig.clusterSize,
      maxCapacity: props.environmentConfig.clusterSize * 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: ecsSecurityGroup,
      spotPrice: '0.10', // Enable spot instances for cost savings
      mixedInstancesPolicy: {
        instancesDistribution: {
          onDemandBaseCapacity: 1,
          onDemandPercentageAboveBaseCapacity: 25,
          spotAllocationStrategy: autoscaling.SpotAllocationStrategy.CAPACITY_OPTIMIZED
        },
        launchTemplate: {
          launchTemplateSpecification: {
            version: '$Default'
          },
          overrides: [
            { instanceType: new ec2.InstanceType(props.environmentConfig.instanceType) },
            { instanceType: new ec2.InstanceType('c6g.large') },
            { instanceType: new ec2.InstanceType('r6g.large') }
          ]
        }
      }
    });

    // IAM Role for EC2 instances
    const ecsRole = new iam.Role(this, 'ECSRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });

    // Add the ASG to the cluster capacity
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
      enableManagedTerminationProtection: true,
      machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
      spotInstanceDraining: true
    });
    
    cluster.addAsgCapacityProvider(capacityProvider);

    // CloudWatch Agent configuration for ECS instances
    new ssm.StringParameter(this, 'ECSCloudWatchParameter', {
      parameterName: `AmazonCloudWatch-${cluster.clusterName}-ECS`,
      stringValue: JSON.stringify({
        agent: {
          metrics_collection_interval: 60,
          run_as_user: 'root'
        },
        logs: {
          logs_collected: {
            files: {
              collect_list: [
                {
                  file_path: '/var/log/messages',
                  log_group_name: `${cluster.clusterName}-/var/log/messages`,
                  log_stream_name: '{instance_id}',
                  retention_in_days: 30
                },
                {
                  file_path: '/var/log/docker',
                  log_group_name: `${cluster.clusterName}-/var/log/docker`,
                  log_stream_name: '{instance_id}',
                  retention_in_days: 30
                },
                {
                  file_path: '/var/log/ecs/ecs-agent.log',
                  log_group_name: `${cluster.clusterName}-/var/log/ecs-agent`,
                  log_stream_name: '{instance_id}',
                  retention_in_days: 30
                }
              ]
            }
          }
        },
        metrics: {
          namespace: 'ECS/ContainerInsights',
          append_dimensions: {
            AutoScalingGroupName: '${aws:AutoScalingGroupName}',
            InstanceId: '${aws:InstanceId}',
            InstanceType: '${aws:InstanceType}'
          },
          metrics_collected: {
            cpu: {
              measurement: [
                'cpu_usage_idle',
                'cpu_usage_iowait',
                'cpu_usage_user',
                'cpu_usage_system'
              ],
              metrics_collection_interval: 60,
              totalcpu: false
            },
            disk: {
              measurement: [
                'used_percent',
                'inodes_free'
              ],
              metrics_collection_interval: 60,
              resources: [
                '/'
              ]
            },
            mem: {
              measurement: [
                'mem_used_percent'
              ],
              metrics_collection_interval: 60
            }
          }
        }
      })
    });

    // Product Service - Fargate with ARM64
    this.createProductService(
      vpc, 
      cluster, 
      httpListener, 
      fargateSecurityGroup, 
      props.environmentConfig
    );

    // Website Service - EC2 with ARM64
    this.createWebsiteService(
      vpc, 
      cluster, 
      httpListener, 
      alb
    );

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'DNS name of the load balancer'
    });

    new cdk.CfnOutput(this, 'ProductServiceUrl', {
      value: `http://${alb.loadBalancerDnsName}/products`,
      description: 'URL of the product service'
    });

    new cdk.CfnOutput(this, 'WebsiteServiceUrl', {
      value: `http://${alb.loadBalancerDnsName}/`,
      description: 'URL of the website service'
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'Name of the ECS cluster'
    });

    new cdk.CfnOutput(this, 'Architecture', {
      value: 'ARM64',
      description: 'CPU architecture being used'
    });
  }

  private createProductService(
    vpc: ec2.Vpc, 
    cluster: ecs.Cluster, 
    listener: elbv2.ApplicationListener,
    securityGroup: ec2.SecurityGroup,
    config: EnvironmentConfig
  ) {
    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'ProductTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Task Role
    const taskRole = new iam.Role(this, 'ProductTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess')
      ]
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords'
      ],
      resources: ['*']
    }));

    // CloudWatch Logs Group
    const logGroup = new logs.LogGroup(this, 'ProductServiceLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProductTaskDefinition', {
      memoryLimitMiB: config.fargateTaskMemory,
      cpu: config.fargateTaskCpu,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
      }
    });

    // Container Definition
    const container = taskDefinition.addContainer('product-service', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-containers/amazon-ecs-sample:latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'product-service',
        logGroup
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60)
      },
      environment: {
        'AWS_REGION': this.region,
        'ARCHITECTURE': 'ARM64'
      }
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ProductTargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3
      },
      deregistrationDelay: cdk.Duration.seconds(30)
    });

    // Listener Rule
    listener.addTargetGroups('ProductRule', {
      targetGroups: [targetGroup],
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/products', '/products/*'])
      ],
      priority: 10
    });

    // Fargate Service
    const service = new ecs.FargateService(this, 'ProductService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      securityGroups: [securityGroup],
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 2
        },
        {
          capacityProvider: 'FARGATE',
          weight: 1
        }
      ],
      circuitBreaker: { rollback: true },
      enableECSManagedTags: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE
    });

    service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    return service;
  }

  private createWebsiteService(
    vpc: ec2.Vpc, 
    cluster: ecs.Cluster, 
    listener: elbv2.ApplicationListener,
    alb: elbv2.ApplicationLoadBalancer
  ) {
    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'WebsiteTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Task Role
    const taskRole = new iam.Role(this, 'WebsiteTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess')
      ]
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords'
      ],
      resources: ['*']
    }));

    // CloudWatch Logs Group
    const logGroup = new logs.LogGroup(this, 'WebsiteServiceLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Task Definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'WebsiteTaskDefinition', {
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      networkMode: ecs.NetworkMode.BRIDGE,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
      }
    });

    // Container Definition
    const container = taskDefinition.addContainer('website-service', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-containers/amazon-ecs-sample:latest'),
      memoryReservationMiB: 256,
      cpu: 256,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'website-service',
        logGroup
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60)
      },
      environment: {
        'PRODUCT_SERVICE_URL': `http://${alb.loadBalancerDnsName}/products`,
        'AWS_REGION': this.region,
        'ARCHITECTURE': 'ARM64'
      }
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 0, // Dynamic port mapping
      protocol: ecs.Protocol.TCP
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'WebsiteTargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3
      },
      deregistrationDelay: cdk.Duration.seconds(30)
    });

    // Listener Rule
    listener.addTargetGroups('WebsiteRule', {
      targetGroups: [targetGroup],
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/'])
      ],
      priority: 1
    });

    // EC2 Service
    const service = new ecs.Ec2Service(this, 'WebsiteService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      placementStrategies: [
        ecs.PlacementStrategy.spreadAcrossInstances(),
        ecs.PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE)
      ],
      placementConstraints: [
        ecs.PlacementConstraint.memberOf('attribute:ecs.cpu-architecture == ARM64')
      ],
      circuitBreaker: { rollback: true },
      enableECSManagedTags: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE
    });

    service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    return service;
  }
}
