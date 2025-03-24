#!/bin/bash
set -e

# Change to the repository root directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r tests/requirements.txt
else
  source venv/bin/activate
fi

# Run cfn-lint to validate templates
echo "Running cfn-lint to validate templates..."
cfn-lint -c tests/cfn-lint-config.yml

# Run unit tests
echo "Running unit tests..."
python -m pytest tests/test_*.py -v

# Run TaskCat tests if AWS credentials are available
if aws sts get-caller-identity &>/dev/null; then
  echo "Running TaskCat tests..."
  cd tests && taskcat test run
else
  echo "AWS credentials not available. Skipping TaskCat tests."
fi

echo "All tests completed successfully!"
