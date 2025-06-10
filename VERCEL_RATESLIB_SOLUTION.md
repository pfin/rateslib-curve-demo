# Rateslib on Vercel: Complete Solution Guide

## The Core Problem

Rateslib is a hybrid Python/Rust library that requires:
1. Rust toolchain to compile the extension modules
2. C compiler for linking
3. Build time that exceeds Vercel's limits
4. Binary compatibility with Vercel's runtime environment

## Solution 1: Pre-built Docker Container on Railway

This is the **recommended production solution**.

### Step 1: Create Dockerfile
```dockerfile
FROM python:3.12-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install maturin for building Python/Rust packages
RUN pip install maturin

# Install rateslib
RUN pip install rateslib

# Copy application
WORKDIR /app
COPY . .

# Install other Python dependencies
RUN pip install -r requirements.txt

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "api_server.py"]
```

### Step 2: Create API Server
```python
# api_server.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import rateslib as rl
from datetime import datetime, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://rateslib-curve-demo.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/curves")
async def build_curves(data: dict):
    # Your existing curve building logic
    return curve_data

@app.post("/api/risk")
async def calculate_risk(data: dict):
    # Your existing risk calculation logic
    return risk_data
```

### Step 3: Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway new

# Deploy
railway up
```

### Step 4: Update Vercel Frontend
```typescript
// In your Next.js app
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-app.railway.app'

const response = await fetch(`${API_URL}/api/curves`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

## Solution 2: AWS Lambda with Custom Layer

### Step 1: Build Lambda Layer
```bash
# Build rateslib for Lambda
docker run -v $(pwd):/var/task public.ecr.aws/lambda/python:3.12 \
  bash -c "pip install rateslib -t python/lib/python3.12/site-packages/"

# Create layer zip
zip -r rateslib-layer.zip python/

# Upload to AWS
aws lambda publish-layer-version \
  --layer-name rateslib \
  --zip-file fileb://rateslib-layer.zip \
  --compatible-runtimes python3.12
```

### Step 2: Deploy Lambda Functions
```python
# lambda_function.py
import json
import rateslib as rl
from datetime import datetime, timedelta

def lambda_handler(event, context):
    body = json.loads(event['body'])
    
    # Your curve building logic
    result = build_curves(body)
    
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(result)
    }
```

## Solution 3: Google Cloud Run

### Step 1: Build Container
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/rateslib-api', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/rateslib-api']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'rateslib-api'
      - '--image=gcr.io/$PROJECT_ID/rateslib-api'
      - '--platform=managed'
      - '--region=us-central1'
      - '--allow-unauthenticated'
```

## Solution 4: Pre-compiled Wheel Distribution

If you control the rateslib distribution:

### Step 1: Build Wheels for Multiple Platforms
```bash
# Build wheels for different platforms
cibuildwheel --platform linux

# This creates wheels for:
# - manylinux2014_x86_64
# - manylinux2014_aarch64
# - musllinux_1_1_x86_64
```

### Step 2: Host Wheels
```bash
# Upload to PyPI or private repository
twine upload dist/*
```

### Step 3: Install in Vercel
```txt
# requirements.txt
--find-links https://your-wheel-host.com/
rateslib==2.0.0
```

## Testing Your Solution

### Local Testing with Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Test locally
vercel dev

# Check Python function
curl http://localhost:3000/api/test_rateslib
```

### Production Testing
```python
# test_deployment.py
import requests
import json

def test_rateslib_api():
    response = requests.post(
        'https://your-api.railway.app/api/curves',
        json={
            'curve_date': '2025-06-10',
            'market_data': {
                'tenors': ['1M', '3M', '6M', '1Y'],
                'rates': [4.31, 4.32, 4.27, 4.09]
            }
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert 'smooth' in data
    assert 'composite' in data
    print("✅ Rateslib API working!")

if __name__ == "__main__":
    test_rateslib_api()
```

## Recommended Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Vercel         │────▶│  Railway/Cloud   │────▶│  Rateslib       │
│  (Next.js)      │     │  (Python API)    │     │  (Calculations) │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
     Frontend              Backend API             Analytics Engine
```

## Cost Comparison

| Platform | Monthly Cost | Setup Complexity | Performance |
|----------|-------------|------------------|-------------|
| Railway | $5-20 | Low | Excellent |
| AWS Lambda | $0-10 | Medium | Good |
| Google Cloud Run | $0-15 | Medium | Excellent |
| Render | $7-25 | Low | Good |

## Quick Start Commands

```bash
# Clone the demo
git clone https://github.com/pfin/rateslib-curve-demo

# Deploy backend to Railway
cd backend
railway up

# Update frontend environment
cd ../frontend
echo "NEXT_PUBLIC_API_URL=https://your-api.railway.app" > .env.local

# Deploy frontend to Vercel
vercel --prod
```

## Support

For help with deployment:
- Railway Discord: https://discord.gg/railway
- Vercel Discord: https://discord.gg/vercel
- Rateslib Issues: https://github.com/attack68/rateslib/issues