#!/usr/bin/env python3
"""
Check the size of installed Python packages
"""
import os
import subprocess
import sys

def get_size(path):
    """Get total size of a directory in MB"""
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if os.path.exists(filepath):
                total += os.path.getsize(filepath)
    return total / (1024 * 1024)  # Convert to MB

def check_package_sizes():
    """Check sizes of Python packages"""
    # First, create a fresh virtual environment
    print("Creating fresh virtual environment...")
    subprocess.run([sys.executable, "-m", "venv", "test_venv"], check=True)
    
    # Install packages
    print("\nInstalling packages...")
    pip_path = os.path.join("test_venv", "bin", "pip") if os.name != "nt" else os.path.join("test_venv", "Scripts", "pip.exe")
    subprocess.run([pip_path, "install", "-r", "api/requirements.txt"], check=True)
    
    # Check site-packages size
    site_packages = os.path.join("test_venv", "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")
    if os.name == "nt":
        site_packages = os.path.join("test_venv", "Lib", "site-packages")
    
    print("\n" + "="*60)
    print("PACKAGE SIZES:")
    print("="*60)
    
    # Check individual package sizes
    packages = {}
    for item in os.listdir(site_packages):
        item_path = os.path.join(site_packages, item)
        if os.path.isdir(item_path) and not item.startswith('_') and not item.endswith('.dist-info'):
            size = get_size(item_path)
            if size > 0.1:  # Only show packages > 0.1 MB
                packages[item] = size
    
    # Sort by size
    for package, size in sorted(packages.items(), key=lambda x: x[1], reverse=True):
        print(f"{package:30} {size:10.2f} MB")
    
    # Total size
    total_size = get_size(site_packages)
    print("="*60)
    print(f"{'TOTAL SIZE':30} {total_size:10.2f} MB")
    print("="*60)
    
    # Also check the total size of the test_venv
    venv_size = get_size("test_venv")
    print(f"\nTotal virtual environment size: {venv_size:.2f} MB")
    
    # Clean up
    import shutil
    shutil.rmtree("test_venv")
    
    return total_size

if __name__ == "__main__":
    check_package_sizes()