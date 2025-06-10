# Rateslib Interactive Demo - Step Function vs Smooth Curves

A Next.js application demonstrating the importance of using step function interpolation for short-end curve construction to properly handle FOMC meeting dates and policy rate changes.

🚀 **[Live Demo](https://your-project-name.vercel.app)** (Update this after deployment)

## Overview

This interactive demo shows why using smooth interpolation for the entire yield curve systematically misprices instruments around central bank meetings. The step function approach (flat-forward interpolation) correctly models the discrete nature of policy rate changes.

## Features

- 📊 **Interactive Curve Visualization**: Real-time comparison of smooth vs step function interpolation
- 📅 **FOMC Date Analysis**: See the impact of central bank meetings on forward rates
- 💰 **Risk Metrics**: Calculate DV01 and NPV differences for instruments spanning FOMC dates
- 🎯 **Market Data Input**: Adjust swap rates and see immediate impact
- 📚 **Educational Content**: Learn best practices for curve construction

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Chart.js
- **Backend**: Python 3.12 serverless functions with rateslib
- **Deployment**: Vercel with automatic GitHub integration
- **Analytics**: Vercel Analytics & Speed Insights

## Key Concepts Demonstrated

1. **Smooth Interpolation Problems**:
   - Averages rate changes over time
   - Misses discrete policy rate jumps
   - Leads to pricing errors for short-term instruments

2. **Step Function Benefits**:
   - Correctly models overnight rate jumps
   - Accurate pricing around FOMC dates
   - Essential for risk management

3. **CompositeCurve Approach**:
   - Step function for short end (<18M)
   - Smooth interpolation for long end (>18M)
   - Best of both worlds

## Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/rateslib-curve-demo.git
cd rateslib-curve-demo/nova_notebooks/nextjs_demo

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
nextjs_demo/
├── app/                    # Next.js 14 App Router
│   ├── page.tsx           # Main demo interface
│   ├── layout.tsx         # App layout with analytics
│   └── api/               # Local API routes for development
├── api/                   # Python serverless functions
│   ├── curves.py          # Curve building with rateslib
│   ├── forwards.py        # Forward rate calculations
│   ├── risk.py           # Risk metrics computation
│   └── requirements.txt   # Python dependencies
├── public/                # Static assets
├── vercel.json           # Vercel deployment config
└── package.json          # Node.js dependencies
```

## Deployment

This project is configured for automatic deployment to Vercel:

1. Push to GitHub
2. Import repository in Vercel
3. Set root directory to `/nova_notebooks/nextjs_demo`
4. Deploy!

See [GITHUB_SETUP.md](GITHUB_SETUP.md) for detailed deployment instructions.

## API Endpoints

### `/api/curves` (POST)
Builds both smooth and step function curves with given market data.

**Request:**
```json
{
  "curve_date": "2024-01-15",
  "market_data": {
    "tenors": ["1W", "2W", "1M", ...],
    "rates": [5.32, 5.32, 5.31, ...]
  },
  "fomc_dates": ["2024-01-31", "2024-03-20", ...]
}
```

### `/api/risk` (POST)
Calculates risk metrics for instruments.

**Request:**
```json
{
  "instrument_type": "swap",
  "start_date": "2024-02-15",
  "end_date": "2024-05-15",
  "notional": 10000000
}
```

## Best Practices Demonstrated

1. **Use flat-forward interpolation** for tenors under 18 months
2. **Include FOMC dates** as explicit curve nodes
3. **Calibrate to turn instruments** (FRAs) around meeting dates
4. **Use smooth interpolation** only for the long end (>18M)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This demo is provided for educational purposes. Rateslib is subject to its own licensing terms.

## Acknowledgments

- Built with [rateslib](https://github.com/attack68/rateslib) - Professional fixed income analytics for Python
- Inspired by real-world trading desk requirements
- Thanks to the Vercel team for excellent deployment infrastructure

## Learn More

- [Rateslib Documentation](https://rateslib.readthedocs.io/)
- [SOFR Transition Resources](https://www.newyorkfed.org/markets/reference-rates/sofr)
- [Understanding Yield Curves](https://rateslib.readthedocs.io/en/latest/g_curves.html)

---

Made with ❤️ for the fixed income community