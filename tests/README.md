# Testing Framework for ECS Reference Architecture

This directory contains tests for validating the CloudFormation templates in this repository, with a focus on ensuring proper Graviton/ARM64 support.

## Test Types

1. **Unit Tests**: Python-based tests that validate template structure and properties
2. **CloudFormation Linting**: Using cfn-lint to validate template syntax and best practices
3. **Integration Tests**: Using TaskCat to deploy templates to AWS regions

## Running Tests

### Prerequisites

- Python 3.8+
- AWS CLI configured with appropriate credentials (for TaskCat tests)
- Docker (optional, for local TaskCat testing)

### Setup

```bash
# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running All Tests

The simplest way to run all tests is to use the provided script:

```bash
./run_tests.sh
```

### Running Individual Test Types

#### Unit Tests

```bash
python -m pytest test_*.py -v
```

#### CloudFormation Linting

```bash
cfn-lint -c cfn-lint-config.yml
```

#### TaskCat Tests

```bash
taskcat test run
```

## Test Coverage

The tests validate:

1. **Graviton Support**: Ensures templates use ARM64 architecture and Graviton instance types
2. **Template Structure**: Validates that resources are properly configured
3. **Parameter Validation**: Checks that parameters have appropriate defaults and constraints
4. **Resource Relationships**: Verifies that resources are properly linked together
5. **Outputs**: Ensures that necessary outputs are exported

## Adding New Tests

To add new tests:

1. Create a new Python file with the prefix `test_` in this directory
2. Use the unittest framework to create test cases
3. Update the TaskCat configuration in `taskcat.yml` if needed

## Continuous Integration

These tests can be integrated into a CI/CD pipeline using GitHub Actions, AWS CodeBuild, or other CI systems. Example GitHub Actions workflow:

```yaml
name: Test CloudFormation Templates

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r tests/requirements.txt
      - name: Run cfn-lint
        run: cfn-lint -c tests/cfn-lint-config.yml
      - name: Run unit tests
        run: python -m pytest tests/test_*.py -v
```
