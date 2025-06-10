# Integrating Rateslib into Large Next.js Projects: A Learning Guide

## Table of Contents
1. [Critical Learnings from Our Demo](#critical-learnings)
2. [Architecture Patterns for Large Projects](#architecture-patterns)
3. [Step-by-Step Integration Guide](#integration-guide)
4. [Performance Optimization](#performance)
5. [Alternative Modern Approaches](#modern-approaches)
6. [Decision Framework](#decision-framework)

## Critical Learnings from Our Demo {#critical-learnings}

### What Actually Works on Vercel (2025)
- ✅ **Rateslib 2.0.0 DOES work** on Vercel Python serverless functions
- ✅ Package size: ~230MB (just under 250MB limit)
- ✅ Python serverless functions with BaseHTTPRequestHandler pattern
- ❌ Cannot mix `/pages/api` and root `/api` directories
- ❌ QuantLib (19.6MB) + rateslib exceeds size limits

### Key Technical Requirements
```json
// vercel.json - Working configuration
{
  "version": 2,
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
      "source": "/api/python/curves",
      "destination": "/api/curves.py"
    }
  ]
}
```

## Architecture Patterns for Large Projects {#architecture-patterns}

### Pattern 1: Hybrid API Architecture (Recommended)
```
your-nextjs-app/
├── app/                      # Next.js 15 App Router
│   ├── api/                  # TypeScript/JS API routes
│   │   ├── users/
│   │   ├── products/
│   │   └── ...existing routes
├── api/                      # Python serverless functions (root level)
│   ├── curves.py            # Rateslib curve building
│   ├── risk.py              # Risk calculations
│   ├── pricing.py           # Derivative pricing
│   └── requirements.txt     # Python dependencies
└── vercel.json
```

**Pros:**
- Clean separation of concerns
- Existing JS/TS routes untouched
- Python functions isolated

**Cons:**
- Two different API patterns
- Potential confusion for developers

### Pattern 2: Microservice Architecture
```
your-nextjs-app/              # Frontend only
├── app/
│   └── (no api routes)
└── lib/
    └── api-client.ts        # Calls external services

rateslib-service/            # Separate deployment
├── api/
│   ├── curves.py
│   └── requirements.txt
└── vercel.json
```

**Pros:**
- Complete isolation
- Can use Railway/Docker for no size limits
- Independent scaling

**Cons:**
- Multiple deployments
- CORS configuration needed
- Higher complexity

### Pattern 3: Edge Function Proxy (Future-looking)
```typescript
// app/api/curves/route.ts
export const runtime = 'edge';

export async function POST(request: Request) {
  // Call Python function or WebAssembly module
  const result = await callPythonFunction(request);
  return Response.json(result);
}
```

## Step-by-Step Integration Guide {#integration-guide}

### Step 1: Assess Your Current Setup

```bash
# Check your API route structure
find . -name "route.ts" -o -name "route.js" | grep api

# Check current bundle size
npm run build
# Look for: Route (app) Size First Load JS
```

### Step 2: Create Python API Structure

```bash
# Create Python API directory at root (NOT in app/)
mkdir api
cd api

# Create requirements.txt
cat > requirements.txt << EOF
rateslib==2.0.0
EOF

# Create a test endpoint
cat > health.py << EOF
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "healthy"}).encode())
EOF
```

### Step 3: Configure Vercel

```json
// vercel.json
{
  "version": 2,
  "framework": "nextjs",
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
    // Your Python endpoints
    {
      "source": "/api/python/:path*",
      "destination": "/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/python/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" }
      ]
    }
  ]
}
```

### Step 4: Create Type-Safe API Client

```typescript
// lib/rateslib-client.ts
interface CurveResponse {
  dates: string[];
  step_forwards: number[];
  smooth_forwards: number[];
}

export class RateslibClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  async buildCurve(curveDate: string): Promise<CurveResponse> {
    const response = await fetch(`${this.baseUrl}/api/python/curves?curve_date=${curveDate}`);
    
    if (!response.ok) {
      throw new Error(`Curve building failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async calculateRisk(portfolio: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/python/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portfolio)
    });
    
    return response.json();
  }
}
```

### Step 5: Implement Python Handlers

```python
# api/curves.py
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
import rateslib as rl

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle curve building requests"""
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}
            
            # Extract parameters
            curve_date = datetime.fromisoformat(data.get('curve_date', '2025-06-10'))
            market_data = data.get('market_data', {})
            
            # Build curves using rateslib
            result = self._build_curves(curve_date, market_data)
            
            # Send response
            self._send_json_response(200, result)
            
        except Exception as e:
            self._send_json_response(500, {
                "error": str(e),
                "type": type(e).__name__
            })
    
    def _build_curves(self, curve_date, market_data):
        """Core curve building logic"""
        # Your rateslib implementation here
        nodes = self._create_nodes(curve_date, market_data)
        
        # Build curves
        step_curve = rl.Curve(
            nodes=nodes,
            interpolation="flat_forward",
            convention="act_360",
            calendar="fed"
        )
        
        smooth_curve = rl.Curve(
            nodes=nodes,
            interpolation="log_linear",
            convention="act_360",
            calendar="fed"
        )
        
        # Generate forward rates
        dates = []
        step_forwards = []
        smooth_forwards = []
        
        for days in range(0, 365, 7):
            date = curve_date + timedelta(days=days)
            future_date = date + timedelta(days=7)
            
            dates.append(date.isoformat())
            step_forwards.append(float(step_curve.rate(date, future_date)) * 100)
            smooth_forwards.append(float(smooth_curve.rate(date, future_date)) * 100)
        
        return {
            "dates": dates,
            "step_forwards": step_forwards,
            "smooth_forwards": smooth_forwards
        }
    
    def _send_json_response(self, status_code, data):
        """Helper to send JSON responses"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
```

## Performance Optimization {#performance}

### 1. Minimize Package Size
```python
# requirements.txt - Start minimal
rateslib==2.0.0
# Add only what you actually use

# Don't include unless needed:
# matplotlib  # 28.67 MB
# pandas      # 66.68 MB
```

### 2. Use Caching Strategies
```typescript
// app/hooks/useRateslibData.ts
import { useQuery } from '@tanstack/react-query';
import { RateslibClient } from '@/lib/rateslib-client';

const client = new RateslibClient();

export function useCurveData(curveDate: string) {
  return useQuery({
    queryKey: ['curve', curveDate],
    queryFn: () => client.buildCurve(curveDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### 3. Implement Request Deduplication
```typescript
// lib/api-utils.ts
const requestCache = new Map<string, Promise<any>>();

export async function deduplicatedFetch(key: string, fetcher: () => Promise<any>) {
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }
  
  const promise = fetcher();
  requestCache.set(key, promise);
  
  try {
    return await promise;
  } finally {
    // Clean up after request completes
    setTimeout(() => requestCache.delete(key), 100);
  }
}
```

## Alternative Modern Approaches {#modern-approaches}

### 1. Edge Functions with WebAssembly (Future)
```javascript
// When Pyodide support arrives for Vercel Edge Functions
export const runtime = 'edge';

import { loadPyodide } from 'pyodide';

let pyodide;

export async function POST(request) {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"
    });
    await pyodide.loadPackage(['numpy']);
  }
  
  const result = await pyodide.runPythonAsync(`
    import numpy as np
    # Your Python code here
  `);
  
  return Response.json(result);
}
```

### 2. Rust-based Alternative
```rust
// Consider rewriting performance-critical parts in Rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn build_curve(nodes: &[f64], dates: &[f64]) -> Vec<f64> {
    // Rust implementation of curve building
}
```

### 3. External Service Pattern
```typescript
// Use Railway/Docker for unlimited package size
const RATESLIB_SERVICE_URL = process.env.RATESLIB_SERVICE_URL;

export async function buildCurve(data: any) {
  const response = await fetch(`${RATESLIB_SERVICE_URL}/curves`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RATESLIB_API_KEY}`
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

## Decision Framework {#decision-framework}

### When to Use Vercel Python Functions
✅ Package size < 230MB total
✅ Cold start performance not critical
✅ Simple deployment preferred
✅ Same domain API calls

### When to Use External Service
✅ Need QuantLib + rateslib together
✅ Package size > 250MB
✅ Complex computational requirements
✅ Need GPU acceleration
✅ Long-running calculations (>5 min)

### When to Wait for Edge/WASM
✅ Millisecond latency requirements
✅ Global edge deployment needed
✅ Very simple Python calculations
✅ Can wait for Pyodide support

## Testing Strategy

```bash
# 1. Test Python functions locally
cd api
python3 -m http.server 3001

# 2. Test with Vercel CLI
vercel dev

# 3. Test production build
vercel build
vercel --prod

# 4. Monitor function size
du -sh api/
# Should be < 250MB after installation
```

## Common Pitfalls to Avoid

1. **Don't mix API directories**
   ```
   ❌ /app/api/  (Next.js routes)
   ❌ /api/      (Python functions)
   ```
   Choose one pattern!

2. **Don't use rateslib datetime helpers**
   ```python
   # ❌ date + rl.dt(days=7)
   # ✅ date + timedelta(days=7)
   ```

3. **Don't forget CORS headers**
   ```python
   self.send_header('Access-Control-Allow-Origin', '*')
   ```

4. **Don't bundle unnecessary dependencies**
   - Start with minimal requirements
   - Add only what you use
   - Monitor total size

## Conclusion

For large Next.js projects, the hybrid architecture (Pattern 1) provides the best balance of:
- Minimal disruption to existing code
- Clean separation of concerns  
- Straightforward deployment
- Good performance

Start with Vercel Python functions, monitor performance and size constraints, and migrate to external services only if needed.