import unittest
import boto3
import json
import os
import yaml
from cfn_tools import load_yaml

class TestECSClusterTemplate(unittest.TestCase):
    """Test cases for the ECS Cluster CloudFormation template"""
    
    def setUp(self):
        self.template_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'infrastructure',
            'ecs-cluster-updated.yaml'
        )
        with open(self.template_path, 'r') as f:
            self.template = load_yaml(f.read())
    
    def test_template_has_graviton_ami(self):
        """Test that the template uses ARM64 AMI for Graviton"""
        ecsami_param = self.template.get('Parameters', {}).get('ECSAMI', {})
        self.assertIsNotNone(ecsami_param, "ECSAMI parameter not found")
        
        default_value = ecsami_param.get('Default', '')
        self.assertIn('arm64', default_value, 
                     f"ECSAMI parameter should reference ARM64 architecture, got: {default_value}")
    
    def test_mixed_instances_policy(self):
        """Test that the Auto Scaling group uses mixed instances policy for Graviton"""
        asg = self.template.get('Resources', {}).get('ECSAutoScalingGroup', {})
        self.assertIsNotNone(asg, "ECSAutoScalingGroup resource not found")
        
        mixed_instances_policy = asg.get('Properties', {}).get('MixedInstancesPolicy', {})
        self.assertIsNotNone(mixed_instances_policy, 
                            "ECSAutoScalingGroup should have MixedInstancesPolicy")
        
        # Check for spot instances configuration
        instances_distribution = mixed_instances_policy.get('InstancesDistribution', {})
        self.assertIsNotNone(instances_distribution, 
                            "MixedInstancesPolicy should have InstancesDistribution")
        
        # Check for instance overrides (different Graviton types)
        launch_template = mixed_instances_policy.get('LaunchTemplate', {})
        self.assertIsNotNone(launch_template, 
                            "MixedInstancesPolicy should have LaunchTemplate")
        
        overrides = launch_template.get('Overrides', [])
        self.assertTrue(len(overrides) > 0, 
                       "LaunchTemplate should have Overrides for different instance types")
    
    def test_runtime_platform_arm64(self):
        """Test that the task definition uses ARM64 architecture"""
        # This test would apply to the service templates
        # We'll check if the template has exports for architecture
        outputs = self.template.get('Outputs', {})
        self.assertIsNotNone(outputs.get('Architecture'), 
                            "Template should export Architecture")
        
        architecture_output = outputs.get('Architecture', {})
        self.assertEqual(architecture_output.get('Value'), 'ARM64',
                        "Architecture output should be ARM64")


if __name__ == '__main__':
    unittest.main()
