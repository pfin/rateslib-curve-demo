# Deploying Rateslib to Vercel

## The Challenge

Rateslib is a hybrid Python/Rust library where Python calls compiled Rust extensions via PyO3. This creates deployment challenges on Vercel because:

1. **No Rust Toolchain**: Vercel's Python runtime doesn't include Rust build tools
2. **Binary Compatibility**: Pre-compiled wheels may not match Vercel's runtime environment
3. **Build Time Limits**: Installing Rust and compiling from source exceeds time limits

## Solutions

### Option 1: Pre-compiled Wheels (Recommended)

Check if rateslib provides wheels for Vercel's environment:
- Linux x86_64
- Python 3.12
- glibc version compatible with Vercel

```bash
# In api/requirements.txt
rateslib>=2.0.0 --prefer-binary
```

### Option 2: Alternative Deployment Platforms

For production use of rateslib, consider:

1. **Railway.app** - Supports custom Docker builds
2. **Render.com** - Allows Rust installation
3. **Google Cloud Run** - Container-based with full control
4. **AWS Lambda** - Using custom layers with pre-compiled binaries

### Option 3: API Gateway Pattern

Deploy rateslib on a platform that supports Rust, then call it from Vercel:

```
Vercel (Next.js) → API Gateway → Container with Rateslib
```

### Option 4: WebAssembly (Future)

If rateslib adds WASM support, it could run directly in the browser.

## Testing Rateslib on Vercel

1. Deploy the test endpoint:
```bash
curl https://your-app.vercel.app/api/test_rateslib
```

2. Check the response for:
- Import success/failure
- Error messages
- Platform details

## Local Development

For local testing with the exact Vercel environment:

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally with Vercel's runtime
vercel dev
```

## Current Status

As of January 2025, Vercel's Python runtime has limitations for Rust extensions. The recommended approach is to:

1. Use pre-compiled wheels if available
2. Deploy rateslib on a container-based platform
3. Call the rateslib API from your Vercel frontend

## Alternative: Dockerfile Deployment

If you need full control, use this Dockerfile on a platform like Railway:

```dockerfile
FROM python:3.12-slim

# Install Rust
RUN apt-get update && apt-get install -y curl build-essential
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install rateslib
RUN pip install rateslib

# Copy and run your app
COPY . /app
WORKDIR /app
CMD ["python", "api_server.py"]
```