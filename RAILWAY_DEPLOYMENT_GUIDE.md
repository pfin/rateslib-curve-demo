# Railway Deployment Guide for Rateslib API

## Prerequisites
- GitHub account
- Credit card for Railway (they offer $5 free credits monthly)

## Step-by-Step Instructions

### 1. Create GitHub Repository for Backend

```bash
# Navigate to the railway directory
cd railway

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial rateslib API for Railway deployment"

# Create a new repo on GitHub (via web interface)
# Name it: rateslib-api-backend

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/rateslib-api-backend.git
git branch -M main
git push -u origin main
```

### 2. Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub
4. Authorize Railway to access your GitHub

### 3. Deploy to Railway

1. **From Railway Dashboard:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `rateslib-api-backend` repository
   - Railway will auto-detect the Dockerfile

2. **Configure Environment:**
   - Click on your service card
   - Go to "Settings" tab
   - Under "Networking":
     - Click "Generate Domain"
     - You'll get a URL like: `rateslib-api-backend-production.up.railway.app`

3. **Monitor Deployment:**
   - Go to "Deployments" tab
   - Watch the build logs
   - Build will take 5-10 minutes (installing Rust + rateslib)

### 4. Test Your API

Once deployed, test the endpoints:

```bash
# Test health check
curl https://your-app.up.railway.app/

# Test curves endpoint
curl -X POST https://your-app.up.railway.app/api/curves \
  -H "Content-Type: application/json" \
  -d '{
    "curve_date": "2025-06-10",
    "market_data": {
      "tenors": ["1M", "3M", "6M", "1Y"],
      "rates": [4.31, 4.32, 4.27, 4.09]
    },
    "fomc_dates": ["2025-06-18", "2025-07-30"]
  }'
```

### 5. Update Your Vercel Frontend

Create `.env.local` in your Next.js project:

```bash
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app
```

Update your frontend code to use this URL:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const response = await fetch(`${API_URL}/api/curves`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

### 6. Redeploy Frontend to Vercel

```bash
vercel --prod
```

## Cost Optimization Tips

1. **Use Sleep Feature**: Railway can sleep your app when not in use
   - Settings → Enable "App Sleeping"
   - Wakes up on first request (adds ~5s delay)
   - Saves ~70% on costs

2. **Monitor Usage**: 
   - Check Railway dashboard for usage metrics
   - Set up usage alerts at $5, $10, $20

3. **Scale Down**: 
   - Start with 0.5 vCPU and 512MB RAM
   - Scale up only if needed

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Common issue: Rust installation timeout
- Solution: Increase build timeout in settings

### API Returns 500
- Check runtime logs in Railway
- Ensure all dependencies are in requirements.txt
- Verify rateslib imports correctly

### CORS Issues
- Already handled in api_server.py
- If issues persist, check allowed origins

### Performance Issues
- Rateslib calculations are CPU intensive
- Consider caching results
- Scale up CPU if needed

## Alternative: Railway CLI

For faster deployments:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy directly
railway up
```

## Monitoring

Railway provides:
- Real-time logs
- CPU/Memory metrics
- Request metrics
- Error tracking

Access via Railway dashboard → Your Project → Observability

## Next Steps

After successful deployment:
1. Test all API endpoints
2. Update frontend environment variables
3. Test the full application flow
4. Set up monitoring alerts
5. Configure custom domain (optional)

## Support

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- Status Page: https://status.railway.app