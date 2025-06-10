"""
Script to install rateslib with proper wheels for Vercel
"""
import subprocess
import sys
import platform

def install_rateslib():
    """Try different methods to install rateslib"""
    
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Machine: {platform.machine()}")
    
    methods = [
        # Method 1: Try pre-built wheel from PyPI
        ["pip", "install", "--only-binary", ":all:", "rateslib"],
        
        # Method 2: Try specific wheel version
        ["pip", "install", "rateslib==2.1.0", "--only-binary", ":all:"],
        
        # Method 3: Try from GitHub releases
        ["pip", "install", "https://github.com/attack68/rateslib/releases/download/v2.1.0/rateslib-2.1.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl"],
        
        # Method 4: Install build tools and compile
        ["pip", "install", "maturin", "setuptools-rust", "rateslib"],
    ]
    
    for i, method in enumerate(methods):
        print(f"\nTrying method {i+1}: {' '.join(method)}")
        try:
            result = subprocess.run(method, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"Success with method {i+1}!")
                return True
            else:
                print(f"Failed: {result.stderr}")
        except Exception as e:
            print(f"Error: {e}")
    
    return False

if __name__ == "__main__":
    if install_rateslib():
        print("\nTesting rateslib import...")
        try:
            import rateslib as rl
            print(f"✅ Rateslib {rl.__version__} imported successfully!")
        except Exception as e:
            print(f"❌ Import failed: {e}")
    else:
        print("\n❌ All installation methods failed")