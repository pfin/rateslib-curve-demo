#!/bin/bash
# Build script for Vercel deployment

echo "=== Starting custom build script ==="
echo "Python version: $(python3 --version)"
echo "Pip version: $(pip --version)"

# Try to install system dependencies (might not work on Vercel)
if command -v apt-get &> /dev/null; then
    echo "Attempting to install system dependencies..."
    apt-get update && apt-get install -y build-essential || echo "apt-get not available"
fi

# Install Rust (might not work on Vercel)
if ! command -v rustc &> /dev/null; then
    echo "Attempting to install Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || echo "Rust installation failed"
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Try different pip install methods
echo "=== Attempting to install rateslib ==="

# Method 1: Try pre-built wheels
echo "Method 1: Trying pre-built wheels..."
pip install --only-binary :all: rateslib==2.0.0 || echo "Method 1 failed"

# Method 2: Try from PyPI with platform tag
echo "Method 2: Trying with platform tag..."
pip install rateslib==2.0.0 --platform manylinux2014_x86_64 --only-binary :all: || echo "Method 2 failed"

# Method 3: Install without dependencies first
echo "Method 3: Trying without deps..."
pip install --no-deps rateslib || echo "Method 3 failed"

# Test if rateslib works
python3 -c "import rateslib; print(f'Rateslib {rateslib.__version__} imported successfully')" || echo "Rateslib import failed"

echo "=== Build script completed ==="