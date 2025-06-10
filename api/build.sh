#!/bin/bash
# Build script for installing rateslib with Rust components on Vercel

echo "Installing system dependencies for Rust..."
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo "Installing maturin..."
pip install maturin

echo "Installing rateslib with pre-compiled wheels if available..."
# Try to install pre-compiled wheel first
pip install rateslib --prefer-binary

# If that fails, build from source
if [ $? -ne 0 ]; then
    echo "Pre-compiled wheel not found, building from source..."
    pip install rateslib --no-binary :all:
fi

echo "Verifying rateslib installation..."
python -c "import rateslib; print(f'Rateslib {rateslib.__version__} installed successfully')"