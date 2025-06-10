# Deployment Guide for Rateslib Next.js Demo

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Deploying to Vercel

### Prerequisites
- Vercel account (free tier works)
- GitHub repository with the code

### Method 1: Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to link to your Vercel account and configure the project.

### Method 2: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will auto-detect Next.js and configure build settings
5. Click "Deploy"

### Python Serverless Functions

The Python functions in `/api` will be automatically deployed as serverless functions. Vercel will:
- Detect Python files in the `api` directory
- Install dependencies from `api/requirements.txt`
- Deploy each `.py` file as a serverless function

### Environment Variables

If needed, add environment variables in Vercel dashboard:
- Go to Project Settings > Environment Variables
- Add any required variables

## Production Considerations

### 1. Python Runtime
- Currently using Python 3.9 (specified in vercel.json)
- Can upgrade to 3.12 by changing runtime in vercel.json

### 2. Cold Starts
- Python serverless functions may have cold start delays
- Consider implementing caching or keeping functions warm

### 3. Rate Limiting
- Add rate limiting to prevent abuse
- Vercel provides built-in DDoS protection

### 4. Error Handling
- Implement proper error boundaries in React
- Add logging for Python functions

### 5. Performance Optimization
- Use SWR or React Query for data fetching
- Implement proper caching strategies
- Consider edge functions for frequently accessed data

## Monitoring

1. **Vercel Analytics**: Automatically included with `@vercel/analytics`
2. **Speed Insights**: Track Core Web Vitals with `@vercel/speed-insights`
3. **Function Logs**: View in Vercel dashboard under Functions tab

## Troubleshooting

### Python Dependencies
If rateslib installation fails:
1. Check Python version compatibility
2. Ensure all C dependencies are available
3. Consider using Docker for complex dependencies

### CORS Issues
CORS headers are already configured in the Python handlers and Next.js API routes.

### Memory Limits
- Vercel serverless functions have memory limits (1024 MB on free tier)
- Monitor function memory usage in dashboard
- Optimize heavy computations or split into smaller functions

## Next Steps

1. Add authentication if needed
2. Implement caching for curve calculations
3. Add more interactive features
4. Create additional demos for other rateslib features