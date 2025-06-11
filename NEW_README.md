# Rateslib Explorer - Interactive Fixed Income Analytics

🚀 **Live Demo**: [https://rateslib-curve-demo.vercel.app](https://rateslib-curve-demo.vercel.app)

An interactive Next.js application demonstrating the power of [rateslib](https://github.com/attack68/rateslib) for professional fixed income analytics. Explore yield curve construction, convexity adjustments, and FOMC date handling with real calculations - no mock data!

## 🌟 Features

### 📊 Interactive Examples
- **Cookbook Examples**: Pre-built examples covering SOFR curves, cross-currency basis, bond futures, and more
- **Live Code Execution**: See the exact rateslib code and run it in real-time
- **Visual Results**: Charts and tables showing curve shapes, forward rates, and risk metrics

### 🛠️ Curve Builder
- **Multiple Interpolation Methods**: Compare flat_forward, log_linear, cubic splines, and more
- **Market Data Input**: Adjust swap rates and see instant curve updates
- **FOMC Node Support**: Include Federal Reserve meeting dates as curve nodes
- **Export Functionality**: Download curve data and calibration results

### 📅 FOMC Date Analysis
- **Meeting Schedule**: Complete 2025-2026 FOMC calendar with market expectations
- **Turn Effects**: Visualize how rate steps at meetings affect forward curves
- **Interpolation Comparison**: See pricing differences between step functions and smooth curves
- **Best Practices**: Learn how to properly handle central bank meeting dates

### 🔬 Convexity Risk
- **STIR Futures Adjustments**: Calculate convexity between futures and swaps
- **Interactive Calculator**: Adjust volatility and time parameters
- **Portfolio Analysis**: Model futures/swaps basis trades
- **Educational Content**: Understand the mathematics behind convexity

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+ (for local API development)
- npm or yarn

### Local Development

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/rateslib-explorer.git
cd rateslib-explorer
```

2. **Install dependencies**:
```bash
# Frontend dependencies
npm install

# Python dependencies for API
pip install -r api/requirements.txt
```

3. **Run the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

### Testing API Endpoints Locally

```bash
# Test curve building
curl -X POST http://localhost:3000/api/curves/build \
  -H "Content-Type: application/json" \
  -d '{"curve_date": "2025-06-10", "interpolation": "log_linear", "market_data": [{"tenor": "1Y", "rate": 4.09}]}'

# Test examples
curl -X POST http://localhost:3000/api/examples \
  -H "Content-Type: application/json" \
  -d '{"example_id": "sofr_curve"}'
```

## 📁 Project Structure

```
.
├── app/                       # Next.js 14 App Router
│   ├── page.tsx              # Home - Step vs smooth curves demo
│   ├── explorer/             # Interactive examples from rateslib cookbook  
│   ├── curves/               # Curve builder interface
│   ├── fomc/                 # FOMC date analysis
│   └── convexity/            # Convexity risk examples
├── api/                      # Python serverless functions
│   ├── curves_modern.py      # Main curve API (FastAPI)
│   ├── examples.py           # Example runner API
│   ├── risk.py               # Risk calculations
│   ├── curves/               # Additional curve endpoints
│   │   └── build.py          # Curve building with options
│   └── requirements.txt      # Python deps (just rateslib!)
├── components/               # Shared React components
│   └── Navigation.tsx        # Main navigation
├── public/                   # Static assets
├── vercel.json              # Vercel deployment config
└── package.json             # Node dependencies
```

## 🔧 Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Chart.js**: Interactive charts with react-chartjs-2
- **Lucide Icons**: Beautiful icon set

### Backend
- **Python 3.9+**: Serverless functions
- **rateslib 2.0.0**: Professional fixed income analytics
- **FastAPI**: Modern Python web framework
- **Mangum**: Adapter for AWS Lambda/Vercel

### Deployment
- **Vercel**: Frontend hosting with serverless functions
- **Edge Network**: Global CDN for fast performance

## 📈 Key Concepts Demonstrated

### 1. Curve Construction
- **Interpolation Methods**: Understand when to use each method
- **Node Placement**: Strategic placement for accurate pricing
- **Calibration**: Solver convergence and error metrics
- **Extrapolation**: Handling points beyond market data

### 2. FOMC Turn Effects  
- **Discrete Rate Changes**: Central banks move in steps, not continuously
- **Pricing Impact**: 5-10% DV01 differences for short instruments
- **CompositeCurve**: Combine interpolation methods by tenor
- **Turn Instruments**: Using FRAs to pin down meeting changes

### 3. Convexity Adjustments
- **Daily Margining**: Why futures differ from swaps
- **Mathematical Formula**: CA = -0.5 × σ² × T₁ × T₂
- **Basis Trading**: Modeling futures/swaps spreads
- **Risk Management**: Gamma exposure in portfolios

### 4. Best Practices
- **No Mock Data**: Every calculation uses real rateslib
- **Production Patterns**: Code you can use in real systems
- **Performance**: Efficient curve construction
- **Accuracy**: Understanding numerical precision

## 🚀 Deployment

### Deploy to Vercel

1. **Fork this repository**

2. **Import to Vercel**:
   - Go to [vercel.com/import](https://vercel.com/import)
   - Select your forked repository
   - Click "Deploy"

3. **Configuration** (automatic):
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Python functions detected automatically

4. **Environment Variables** (optional):
   - None required for basic functionality
   - Add `NEXT_PUBLIC_API_URL` for custom API endpoints

### Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

## 📚 Learning Resources

### Rateslib Documentation
- [Official Docs](https://rateslib.readthedocs.io/)
- [Cookbook Examples](https://rateslib.readthedocs.io/en/latest/g_cookbook.html)
- [API Reference](https://rateslib.readthedocs.io/en/latest/i_api.html)

### Key Topics
- [Curve Construction](https://rateslib.readthedocs.io/en/latest/g_curves.html)
- [Automatic Differentiation](https://rateslib.readthedocs.io/en/latest/u_dual.html)
- [Convexity Risk](https://rateslib.readthedocs.io/en/latest/z_convexityrisk.html)
- [Multi-Currency](https://rateslib.readthedocs.io/en/latest/e_multicurrency.html)

### Video Tutorials
- Coming soon!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
1. **No Mock Data**: All examples must use real rateslib calculations
2. **Educational Focus**: Code should teach best practices
3. **Performance**: Keep API responses under 1 second
4. **Accessibility**: Ensure UI works on mobile devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [rateslib](https://github.com/attack68/rateslib) by attack68 - The powerful fixed income library that powers all calculations
- [Next.js](https://nextjs.org/) team for an amazing framework
- [Vercel](https://vercel.com/) for seamless deployment

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/rateslib-explorer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/rateslib-explorer/discussions)
- **Rateslib Support**: [rateslib GitHub](https://github.com/attack68/rateslib)

---

<p align="center">
  Made with ❤️ using <a href="https://github.com/attack68/rateslib">rateslib</a>
</p>