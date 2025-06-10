# Successfully Deploying Rateslib 2.0.0 to Vercel

## Overview
We successfully deployed a Next.js application with Python serverless functions using rateslib 2.0.0 to Vercel, despite initial challenges with package size limits.

## Key Requirements for Success

### 1. Remove Large Dependencies
- **Removed QuantLib** (19.6MB) - this was the critical step
- Keep only essential dependencies in `requirements.txt`:
  ```
  rateslib==2.0.0
  ```

### 2. Use Correct Vercel Configuration
The working `vercel.json` configuration:
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "builds": [
    {
      "src": "api/*.py",
      "use": "@vercel/python",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "rewrites": [
    {
      "source": "/api/hello",
      "destination": "/api/hello.py"
    },
    {
      "source": "/api/curves",
      "destination": "/api/curves_rateslib_only.py"
    },
    {
      "source": "/api/hello_rateslib", 
      "destination": "/api/hello_rateslib.py"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" }
      ]
    }
  ]
}
```

### 3. Package Sizes (What Fits in Vercel's 250MB Limit)
With just rateslib 2.0.0, the total package sizes are:
- pandas: 66.68 MB
- numpy: 39.20 MB + numpy.libs: 26.80 MB = 66 MB total  
- matplotlib: 28.67 MB
- fontTools: 24.32 MB (matplotlib dependency)
- rateslib: 7.70 MB
- **Total: ~230 MB** (just under the 250MB limit)

### 4. Python API Handler Pattern
Use the BaseHTTPRequestHandler pattern for Python serverless functions:
```python
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Your code here
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
```

### 5. Important Gotchas Fixed

1. **Use standard Python datetime operations** instead of rateslib-specific datetime functions:
   ```python
   # Don't use: date + rl.dt(days=7)
   # Use: date + timedelta(days=7)
   ```

2. **Use "builds" + "rewrites"** not "functions" + "routes" when using Next.js framework

3. **Remove conflicting directories**: Don't have both `/api` and `/app/api` directories

4. **Update to latest versions**:
   - Next.js 15.3.3
   - React 19.1.0
   - QuantLib 1.38 (if needed, but too large for Vercel)

## Working Endpoints

The deployment successfully provides:
- `/api/hello` - Basic Python test endpoint
- `/api/hello_rateslib` - Tests rateslib import and basic curve creation
- `/api/curves` - Full curve building with step function vs smooth interpolation

## Conclusion

**Railway is NOT needed!** Vercel can successfully run rateslib 2.0.0 as long as:
1. You stay under the 250MB function size limit
2. You don't include large additional packages like QuantLib
3. You use the correct configuration syntax
4. You handle datetime operations with standard Python libraries

The key insight was that rateslib itself is only 7.7MB, but its dependencies (pandas, numpy, matplotlib) bring the total to ~230MB, which just fits within Vercel's limits.