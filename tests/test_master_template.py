import unittest
import os
import yaml
from cfn_tools import load_yaml

class TestMasterTemplate(unittest.TestCase):
    """Test cases for the Master CloudFormation template"""
    
    def setUp(self):
        self.template_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'master-updated.yaml'
        )
        with open(self.template_path, 'r') as f:
            self.template = load_yaml(f.read())
    
    def test_environment_mapping(self):
        """Test that the template has environment mappings for Graviton instances"""
        mappings = self.template.get('Mappings', {})
        self.assertIn('EnvironmentConfiguration', mappings,
                     "Template should have EnvironmentConfiguration mapping")
        
        env_config = mappings.get('EnvironmentConfiguration', {})
        
        # Check Development environment
        self.assertIn('Development', env_config,
                     "EnvironmentConfiguration should have Development environment")
        dev_config = env_config.get('Development', {})
        self.assertIn('InstanceType', dev_config,
                     "Development config should have InstanceType")
        self.assertTrue(dev_config.get('InstanceType').startswith('t4g.') or 
                       dev_config.get('InstanceType').startswith('m6g.') or
                       dev_config.get('InstanceType').startswith('c6g.') or
                       dev_config.get('InstanceType').startswith('r6g.'),
                       f"Development InstanceType should be Graviton-based, got: {dev_config.get('InstanceType')}")
        
        # Check Production environment
        self.assertIn('Production', env_config,
                     "EnvironmentConfiguration should have Production environment")
        prod_config = env_config.get('Production', {})
        self.assertIn('InstanceType', prod_config,
                     "Production config should have InstanceType")
        self.assertTrue(prod_config.get('InstanceType').startswith('t4g.') or 
                       prod_config.get('InstanceType').startswith('m6g.') or
                       prod_config.get('InstanceType').startswith('c6g.') or
                       prod_config.get('InstanceType').startswith('r6g.'),
                       f"Production InstanceType should be Graviton-based, got: {prod_config.get('InstanceType')}")
        
        # Check SpotConfiguration
        self.assertIn('SpotConfiguration', env_config,
                     "EnvironmentConfiguration should have SpotConfiguration")
        spot_config = env_config.get('SpotConfiguration', {})
        self.assertIn('InstanceTypes', spot_config,
                     "SpotConfiguration should have InstanceTypes")
        
        # Check that spot instance types are Graviton-based
        spot_instances = spot_config.get('InstanceTypes', [])
        for instance in spot_instances:
            self.assertTrue(instance.startswith('t4g.') or 
                           instance.startswith('m6g.') or
                           instance.startswith('c6g.') or
                           instance.startswith('r6g.'),
                           f"Spot instance type should be Graviton-based, got: {instance}")
    
    def test_architecture_output(self):
        """Test that the template exports the architecture"""
        outputs = self.template.get('Outputs', {})
        self.assertIn('Architecture', outputs,
                     "Template should export Architecture")
        
        arch_output = outputs.get('Architecture', {})
        self.assertEqual(arch_output.get('Value'), 'ARM64',
                        "Architecture output should be ARM64")
    
    def test_ecs_cluster_parameters(self):
        """Test that the ECS cluster is configured with Graviton parameters"""
        resources = self.template.get('Resources', {})
        self.assertIn('ECSCluster', resources,
                     "Template should have ECSCluster resource")
        
        ecs_cluster = resources.get('ECSCluster', {})
        params = ecs_cluster.get('Properties', {}).get('Parameters', {})
        
        # Check that instance type is from the mapping
        instance_type = params.get('InstanceType', '')
        self.assertIn('FindInMap', str(instance_type),
                     "InstanceType should use FindInMap for Graviton instances")
        
        # Check that SpotInstanceTypes parameter is passed
        spot_instances = params.get('SpotInstanceTypes', '')
        self.assertIsNotNone(spot_instances,
                            "ECSCluster should have SpotInstanceTypes parameter")


if __name__ == '__main__':
    unittest.main()
