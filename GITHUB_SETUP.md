# GitHub Setup for Vercel Deployment

## Project Structure

The root directory for deployment should be:
```
/nova_notebooks/nextjs_demo/
```

This is the directory containing:
- `package.json`
- `vercel.json`
- `app/` (Next.js app directory)
- `api/` (Python serverless functions)

## Steps to Deploy

### 1. Create GitHub Repository

Create a new repository for the demo (e.g., `rateslib-curve-demo`)

### 2. Push the Code

```bash
# Navigate to the demo directory
cd /home/peter/SwapPulse/read_only/rateslib/nova_notebooks/nextjs_demo

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Rateslib curve interpolation demo"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/rateslib-curve-demo.git

# Push
git push -u origin main
```

### 3. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. **IMPORTANT**: Set the root directory to: `/nova_notebooks/nextjs_demo`
   - In Vercel's import settings, look for "Root Directory"
   - Click "Edit" and enter: `nova_notebooks/nextjs_demo`
5. Vercel will auto-detect Next.js framework
6. Click "Deploy"

### 4. Environment Variables (Optional)

If you need any environment variables, add them in Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add any required variables

## Directory Structure in GitHub

Your repository structure should look like:
```
rateslib-curve-demo/
├── nova_notebooks/
│   └── nextjs_demo/
│       ├── package.json
│       ├── vercel.json
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── .gitignore
│       ├── .vercelignore
│       ├── README.md
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   └── api/
│       │       ├── curves/route.ts
│       │       └── risk/route.ts
│       ├── api/
│       │   ├── requirements.txt
│       │   ├── curves.py
│       │   ├── forwards.py
│       │   └── risk.py
│       └── public/
└── (other files if needed)
```

## Important Configuration

The `vercel.json` file is configured with:
- **Python Runtime**: 3.12 (latest supported)
- **Framework**: Next.js
- **Serverless Functions**: Python files in `/api` directory
- **Regions**: US East (iad1) for low latency

## Troubleshooting

### If deployment fails:

1. **Check Root Directory**: Ensure Vercel is using `/nova_notebooks/nextjs_demo` as root
2. **Python Dependencies**: Check that `rateslib` is available for Python 3.12
3. **Build Logs**: Check Vercel build logs for specific errors
4. **Function Logs**: After deployment, check function logs in Vercel dashboard

### Common Issues:

1. **Module not found**: Ensure all Python dependencies are in `api/requirements.txt`
2. **Build errors**: Check that all TypeScript types are correct
3. **Runtime errors**: Check Python function logs in Vercel dashboard

## Local Testing Before Deployment

```bash
# Install dependencies
npm install

# Test build
npm run build

# Test locally
npm run dev
```

Visit http://localhost:3000 to test the application.

## Post-Deployment

After successful deployment:
1. Your app will be available at: `https://your-project-name.vercel.app`
2. Custom domain can be added in Vercel dashboard
3. Monitor performance with Vercel Analytics
4. Check function execution logs for any issues

## Updating the Demo

To update after changes:
```bash
git add .
git commit -m "Update: description of changes"
git push
```

Vercel will automatically redeploy on push to main branch.