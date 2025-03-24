import unittest
import os
import yaml
from cfn_tools import load_yaml

class TestFargateServiceTemplate(unittest.TestCase):
    """Test cases for the Fargate Service CloudFormation template"""
    
    def setUp(self):
        self.template_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'services',
            'product-service',
            'service-fargate.yaml'
        )
        with open(self.template_path, 'r') as f:
            self.template = load_yaml(f.read())
    
    def test_architecture_parameter(self):
        """Test that the template has an Architecture parameter"""
        params = self.template.get('Parameters', {})
        self.assertIn('Architecture', params, 
                     "Template should have Architecture parameter")
        
        arch_param = params.get('Architecture', {})
        self.assertEqual(arch_param.get('Default'), 'ARM64',
                        "Architecture parameter should default to ARM64")
        
        allowed_values = arch_param.get('AllowedValues', [])
        self.assertIn('ARM64', allowed_values,
                     "Architecture parameter should allow ARM64")
    
    def test_task_definition_runtime_platform(self):
        """Test that the task definition uses RuntimePlatform for ARM64"""
        task_def = self.template.get('Resources', {}).get('TaskDefinition', {})
        self.assertIsNotNone(task_def, "TaskDefinition resource not found")
        
        runtime_platform = task_def.get('Properties', {}).get('RuntimePlatform', {})
        self.assertIsNotNone(runtime_platform, 
                            "TaskDefinition should have RuntimePlatform")
        
        # Check that it references the Architecture parameter
        cpu_arch = runtime_platform.get('CpuArchitecture', '')
        self.assertIn('Architecture', str(cpu_arch),
                     "RuntimePlatform should reference Architecture parameter")
    
    def test_fargate_compatibility(self):
        """Test that the task definition is compatible with Fargate"""
        task_def = self.template.get('Resources', {}).get('TaskDefinition', {})
        self.assertIsNotNone(task_def, "TaskDefinition resource not found")
        
        requires_compat = task_def.get('Properties', {}).get('RequiresCompatibilities', [])
        self.assertIn('FARGATE', requires_compat,
                     "TaskDefinition should be compatible with FARGATE")
    
    def test_service_launch_type(self):
        """Test that the service uses Fargate launch type"""
        service = self.template.get('Resources', {}).get('Service', {})
        self.assertIsNotNone(service, "Service resource not found")
        
        launch_type = service.get('Properties', {}).get('LaunchType', '')
        self.assertEqual(launch_type, 'FARGATE',
                        "Service should use FARGATE launch type")
    
    def test_architecture_output(self):
        """Test that the template exports the architecture"""
        outputs = self.template.get('Outputs', {})
        self.assertIn('Architecture', outputs,
                     "Template should export Architecture")


if __name__ == '__main__':
    unittest.main()
