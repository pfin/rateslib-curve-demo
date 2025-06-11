#!/usr/bin/env python3
"""
Test the modern API locally before deploying
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from curves_modern import app
import uvicorn

if __name__ == "__main__":
    print("Starting FastAPI server on http://localhost:8000")
    print("Test endpoints:")
    print("  - http://localhost:8000/health")
    print("  - http://localhost:8000/fomc-dates")
    print("  - http://localhost:8000/curves?curve_date=2025-06-10")
    print("  - http://localhost:8000/docs (Auto-generated API docs)")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)