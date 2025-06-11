'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Calculator, TrendingUp, AlertCircle, Info, BookOpen, ChevronRight, Play, Code, BarChart3, Lightbulb } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale)

// Rateslib-specific convexity examples
const CONVEXITY_EXAMPLES = [
  {
    id: 'stir_convexity',
    title: 'STIR Futures Convexity Adjustment',
    description: 'Calculate convexity adjustments between futures and swaps',
    formula: 'CA = -0.5 × σ² × T₁ × T₂',
    code: `# STIR Convexity Adjustment Calculation
import rateslib as rl
from datetime import datetime as dt
import numpy as np

# Create curves for STIR and IRS
stir_curve = rl.Curve(
    nodes={
        dt(2025, 6, 10): 1.0,
        dt(2025, 9, 17): 1.0,  # Sep IMM
        dt(2025, 12, 17): 1.0,  # Dec IMM
        dt(2026, 3, 17): 1.0,   # Mar IMM
        dt(2026, 6, 16): 1.0,   # Jun IMM
    },
    id="stir",
    convention="act360"
)

irs_curve = rl.Curve(
    nodes={
        dt(2025, 6, 10): 1.0,
        dt(2025, 9, 17): 1.0,
        dt(2025, 12, 17): 1.0,
        dt(2026, 3, 17): 1.0,
        dt(2026, 6, 16): 1.0,
    },
    id="irs",
    convention="act360"
)

# Create STIR futures
futures = [
    rl.STIRFuture(
        dt(2025, 6, 18), dt(2025, 9, 17),
        spec="usd_stir", curves="stir"
    ),
    rl.STIRFuture(
        dt(2025, 9, 17), dt(2025, 12, 17),
        spec="usd_stir", curves="stir"
    ),
]

# Create equivalent IRS
swaps = [
    rl.IRS(
        effective=dt(2025, 6, 18),
        termination=dt(2025, 9, 17),
        frequency="Q",
        convention="act360",
        leg2_index_base="SOFR",
        curves="irs"
    ),
    rl.IRS(
        effective=dt(2025, 9, 17),
        termination=dt(2025, 12, 17),
        frequency="Q",
        convention="act360",
        leg2_index_base="SOFR",
        curves="irs"
    ),
]

# Calculate convexity adjustments
# Assume 75bps volatility
vol = 0.75  # 75 bps
adjustments = []

for future, swap in zip(futures, swaps):
    # Time to expiry
    T1 = (future.delivery - dt(2025, 6, 10)).days / 365
    # Time to maturity
    T2 = (future.termination - future.delivery).days / 365
    
    # Convexity adjustment
    CA = -0.5 * (vol/100)**2 * T1 * T2 * 10000  # in bps
    
    adjustments.append({
        'contract': f"{future.delivery.strftime('%b%y')}",
        'T1': T1,
        'T2': T2,
        'adjustment_bps': CA
    })
    
    print(f"{future.delivery.strftime('%b%y')}: CA = {CA:.2f} bps")`
  },
  {
    id: 'portfolio_risk',
    title: 'Portfolio Convexity Risk',
    description: 'Analyze convexity risk across a portfolio of STIR futures and swaps',
    formula: 'Gamma = ∂²PV/∂y²',
    code: `# Portfolio Convexity Risk Analysis
import rateslib as rl
from datetime import datetime as dt
import pandas as pd

# Build a portfolio of STIR futures and offsetting swaps
portfolio = []

# Add STIR futures (long position)
for i in range(4):  # 4 quarterly contracts
    delivery = dt(2025, 9, 17) + i * timedelta(days=91)
    termination = delivery + timedelta(days=91)
    
    future = rl.STIRFuture(
        delivery, termination,
        spec="usd_stir",
        curves="stir",
        contracts=100  # 100 contracts
    )
    portfolio.append(('Future', future))

# Add offsetting swaps (short position)
for i in range(4):
    effective = dt(2025, 9, 17) + i * timedelta(days=91)
    termination = effective + timedelta(days=91)
    
    swap = rl.IRS(
        effective=effective,
        termination=termination,
        frequency="Q",
        convention="act360",
        notional=-100_000_000,  # -$100MM
        leg2_index_base="SOFR",
        curves="irs"
    )
    portfolio.append(('Swap', swap))

# Calculate risk metrics
results = []
for instr_type, instrument in portfolio:
    # NPV
    npv = instrument.npv(curves)
    
    # DV01 (Delta)
    dv01 = instrument.dv01(curves)
    
    # Gamma (Convexity)
    gamma = instrument.gamma(curves)
    
    results.append({
        'Type': instr_type,
        'Maturity': instrument.termination,
        'NPV': npv,
        'DV01': dv01,
        'Gamma': gamma
    })

# Create DataFrame
risk_df = pd.DataFrame(results)

# Calculate portfolio totals
portfolio_npv = risk_df['NPV'].sum()
portfolio_dv01 = risk_df['DV01'].sum()
portfolio_gamma = risk_df['Gamma'].sum()

print("Portfolio Risk Summary:")
print(f"NPV: $\\{portfolio_npv:,.2f\\}")
print(f"DV01: $\\{portfolio_dv01:,.2f\\}")
print(f"Gamma: $\\{portfolio_gamma:,.2f\\}")
print("\\\\nDetailed Risk:")
print(risk_df)`
  },
  {
    id: 'spread_instruments',
    title: 'Futures-Swaps Spread Trading',
    description: 'Model the basis between STIR futures and IRS',
    formula: 'Spread = Futures Rate - Swap Rate + CA',
    code: `# Futures-Swaps Spread Instruments
import rateslib as rl
from datetime import datetime as dt

# Create spread instruments to model basis
class FuturesSwapSpread:
    """Models the spread between STIR futures and IRS"""
    
    def __init__(self, delivery, termination, spread_bps):
        # STIR Future leg
        self.future = rl.STIRFuture(
            delivery, termination,
            spec="usd_stir",
            curves="stir"
        )
        
        # IRS leg
        self.swap = rl.IRS(
            effective=delivery,
            termination=termination,
            frequency="Q",
            convention="act360",
            notional=-self.future.notional,
            leg2_index_base="SOFR",
            curves="irs"
        )
        
        # Spread (includes convexity adjustment)
        self.spread = spread_bps / 10000
    
    def npv(self, curves):
        """Calculate spread NPV"""
        future_npv = self.future.npv(curves)
        swap_npv = self.swap.npv(curves)
        spread_npv = self.spread * self.future.notional * 0.25
        return future_npv + swap_npv + spread_npv
    
    def rate_differential(self, curves):
        """Calculate rate differential"""
        future_rate = self.future.rate(curves)
        swap_rate = self.swap.rate(curves)
        return (future_rate - swap_rate) * 10000  # in bps

# Create spread instruments with market-observed spreads
spreads = [
    FuturesSwapSpread(dt(2025, 9, 17), dt(2025, 12, 17), 3.5),
    FuturesSwapSpread(dt(2025, 12, 17), dt(2026, 3, 17), 4.2),
    FuturesSwapSpread(dt(2026, 3, 17), dt(2026, 6, 16), 5.1),
]

# Analyze spreads
for i, spread_instr in enumerate(spreads):
    rate_diff = spread_instr.rate_differential(curves)
    print(f"Contract {i+1}:")
    print(f"  Rate Differential: {rate_diff:.2f} bps")
    print(f"  Market Spread: {spread_instr.spread*10000:.2f} bps")
    print(f"  Implied Vol: {np.sqrt(2*abs(spread_instr.spread)*365/0.5):.1f} bps")`
  },
  {
    id: 'curve_calibration',
    title: 'Convexity-Adjusted Curve Building',
    description: 'Build curves that incorporate convexity adjustments',
    formula: 'IRS Rate = Futures Rate - CA',
    code: `# Build Convexity-Adjusted Curves
import rateslib as rl
from datetime import datetime as dt

# Market data
futures_prices = {
    'Sep25': 95.75,  # 4.25%
    'Dec25': 95.80,  # 4.20%
    'Mar26': 95.85,  # 4.15%
    'Jun26': 95.90,  # 4.10%
}

# Convert to rates and add convexity adjustments
market_data = []
for contract, price in futures_prices.items():
    futures_rate = 100 - price
    
    # Estimate convexity adjustment
    if contract == 'Sep25':
        ca = 3.5 / 100  # 3.5 bps
    elif contract == 'Dec25':
        ca = 4.5 / 100  # 4.5 bps
    elif contract == 'Mar26':
        ca = 5.5 / 100  # 5.5 bps
    else:
        ca = 6.5 / 100  # 6.5 bps
    
    swap_rate = futures_rate - ca
    market_data.append((contract, futures_rate, ca, swap_rate))

# Create instruments for curve building
instruments = []
rates = []

base_date = dt(2025, 6, 10)
for contract, fut_rate, ca, swap_rate in market_data:
    # Determine dates
    if 'Sep' in contract:
        eff_date = dt(2025, 9, 17)
    elif 'Dec' in contract:
        eff_date = dt(2025, 12, 17)
    elif 'Mar' in contract:
        eff_date = dt(2026, 3, 17)
    else:
        eff_date = dt(2026, 6, 16)
    
    term_date = eff_date + timedelta(days=91)
    
    # Create IRS instrument
    swap = rl.IRS(
        effective=eff_date,
        termination=term_date,
        frequency="Q",
        convention="act360",
        fixed_rate=swap_rate,
        leg2_index_base="SOFR",
        curves="irs"
    )
    
    instruments.append(swap)
    rates.append(swap_rate)

# Build the curve
curve = rl.Curve(
    nodes={base_date: 1.0},
    id="irs",
    convention="act360"
)

# Add nodes for each instrument
for inst in instruments:
    curve.nodes[inst.termination] = 1.0

# Solve
solver = rl.Solver(
    curves=[curve],
    instruments=instruments,
    s=rates,
    id="Convexity-Adjusted IRS Curve"
)

print(f"Calibration successful: {solver.result['success']}")
print(f"Max error: {max(abs(solver.result['fun']))*10000:.2f} bps")`
  }
]

export default function ConvexityRiskExplorer() {
  const [activeExample, setActiveExample] = useState(CONVEXITY_EXAMPLES[0])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(true)
  
  // Interactive parameters
  const [volatility, setVolatility] = useState(75) // bps
  const [timeToExpiry, setTimeToExpiry] = useState(0.5) // years
  const [timeToMaturity, setTimeToMaturity] = useState(0.75) // years

  // Calculate convexity adjustment
  const calculateConvexity = useCallback(() => {
    const ca = -0.5 * Math.pow(volatility / 10000, 2) * timeToExpiry * timeToMaturity * 10000
    return ca
  }, [volatility, timeToExpiry, timeToMaturity])

  // Run example
  const runExample = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // For demo purposes, generate results based on example
      const mockResults = generateMockResults(activeExample.id)
      setResults(mockResults)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeExample])

  // Generate mock results
  function generateMockResults(exampleId: string) {
    switch (exampleId) {
      case 'stir_convexity':
        return {
          type: 'convexity_table',
          data: [
            { contract: 'Sep25', T1: 0.25, T2: 0.25, futures_rate: 4.25, adjustment_bps: 3.5, swap_rate: 4.215 },
            { contract: 'Dec25', T1: 0.50, T2: 0.25, futures_rate: 4.20, adjustment_bps: 4.7, swap_rate: 4.153 },
            { contract: 'Mar26', T1: 0.75, T2: 0.25, futures_rate: 4.15, adjustment_bps: 5.9, swap_rate: 4.091 },
            { contract: 'Jun26', T1: 1.00, T2: 0.25, futures_rate: 4.10, adjustment_bps: 7.0, swap_rate: 4.030 },
          ]
        }
      
      case 'portfolio_risk':
        return {
          type: 'risk_analysis',
          data: {
            positions: [
              { type: 'Future', maturity: 'Sep25', npv: 0, dv01: 2500, gamma: 0 },
              { type: 'Swap', maturity: 'Sep25', npv: -8750, dv01: -2500, gamma: 12.5 },
              { type: 'Future', maturity: 'Dec25', npv: 0, dv01: 2500, gamma: 0 },
              { type: 'Swap', maturity: 'Dec25', npv: -11750, dv01: -2500, gamma: 15.0 },
            ],
            portfolio: {
              npv: -20500,
              dv01: 0,
              gamma: 27.5
            }
          }
        }
      
      case 'spread_instruments':
        return {
          type: 'spread_analysis',
          data: [
            { contract: 'Sep25', rate_diff: 3.5, market_spread: 3.5, implied_vol: 74 },
            { contract: 'Dec25', rate_diff: 4.7, market_spread: 4.2, implied_vol: 86 },
            { contract: 'Mar26', rate_diff: 5.9, market_spread: 5.1, implied_vol: 95 },
            { contract: 'Jun26', rate_diff: 7.0, market_spread: 6.5, implied_vol: 107 },
          ]
        }
      
      default:
        return { type: 'text', data: 'Calculation completed successfully' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calculator className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Convexity Risk Analysis with Rateslib
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  STIR futures convexity adjustments and portfolio risk
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Info className="h-4 w-4" />
              <span>Based on rateslib convexity examples</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Examples */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4">Convexity Examples</h2>
              <div className="space-y-2">
                {CONVEXITY_EXAMPLES.map((example) => (
                  <button
                    key={example.id}
                    onClick={() => setActiveExample(example)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeExample.id === example.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <h3 className="font-medium text-sm">{example.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {example.description}
                    </p>
                    <div className="mt-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                      {example.formula}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Calculator */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-4">
              <h3 className="font-semibold mb-4">Quick Calculator</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Volatility (bps)
                  </label>
                  <input
                    type="number"
                    value={volatility}
                    onChange={(e) => setVolatility(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Time to Expiry (years)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={timeToExpiry}
                    onChange={(e) => setTimeToExpiry(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Time to Maturity (years)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={timeToMaturity}
                    onChange={(e) => setTimeToMaturity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="pt-2 border-t dark:border-gray-700">
                  <p className="text-sm font-medium">Convexity Adjustment</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {calculateConvexity().toFixed(2)} bps
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Example Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{activeExample.title}</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {activeExample.description}
                  </p>
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="font-mono text-lg text-blue-800 dark:text-blue-200">
                      {activeExample.formula}
                    </p>
                  </div>
                </div>
                <button
                  onClick={runExample}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>{loading ? 'Running...' : 'Run Example'}</span>
                </button>
              </div>

              {/* Code/Output Toggle */}
              <div className="flex space-x-4 border-b dark:border-gray-700">
                <button
                  onClick={() => setShowCode(true)}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                    showCode 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>Code</span>
                  </div>
                </button>
                <button
                  onClick={() => setShowCode(false)}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                    !showCode 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Results</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Code Section */}
            {showCode && (
              <div className="bg-gray-900 rounded-lg shadow p-6">
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  <code>{activeExample.code}</code>
                </pre>
              </div>
            )}

            {/* Results Section */}
            {!showCode && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                )}

                {results && !loading && renderResults(results)}

                {!results && !loading && (
                  <div className="text-center py-12 text-gray-500">
                    Click &quot;Run Example&quot; to see results
                  </div>
                )}
              </div>
            )}

            {/* Educational Content */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <Lightbulb className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                    Key Insights
                  </h3>
                  {renderEducationalContent(activeExample.id)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render results based on type
  function renderResults(results: any) {
    switch (results.type) {
      case 'convexity_table':
        return (
          <div>
            <h3 className="font-semibold mb-4">Convexity Adjustments by Contract</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2">Contract</th>
                    <th className="text-right py-2">T₁ (years)</th>
                    <th className="text-right py-2">T₂ (years)</th>
                    <th className="text-right py-2">Futures Rate</th>
                    <th className="text-right py-2">CA (bps)</th>
                    <th className="text-right py-2">Swap Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.map((row: any) => (
                    <tr key={row.contract} className="border-b dark:border-gray-700">
                      <td className="py-2 font-medium">{row.contract}</td>
                      <td className="text-right">{row.T1.toFixed(2)}</td>
                      <td className="text-right">{row.T2.toFixed(2)}</td>
                      <td className="text-right">{row.futures_rate.toFixed(3)}%</td>
                      <td className="text-right text-red-600">{row.adjustment_bps.toFixed(1)}</td>
                      <td className="text-right font-medium">{row.swap_rate.toFixed(3)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Chart */}
            <div className="mt-6 h-64">
              <Bar
                data={{
                  labels: results.data.map((r: any) => r.contract),
                  datasets: [
                    {
                      label: 'Convexity Adjustment (bps)',
                      data: results.data.map((r: any) => r.adjustment_bps),
                      backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: {
                      title: {
                        display: true,
                        text: 'Basis Points'
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        )
      
      case 'risk_analysis':
        return (
          <div>
            <h3 className="font-semibold mb-4">Portfolio Risk Analysis</h3>
            
            {/* Individual positions */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Individual Positions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.data.positions.map((pos: any, idx: number) => (
                  <div key={idx} className="p-4 border dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">{pos.type} - {pos.maturity}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        pos.type === 'Future' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {pos.type}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>NPV:</span>
                        <span className="font-mono">${pos.npv.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DV01:</span>
                        <span className="font-mono">${pos.dv01.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gamma:</span>
                        <span className="font-mono">${pos.gamma.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Portfolio summary */}
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold mb-4">Portfolio Summary</h4>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total NPV</p>
                  <p className="text-2xl font-bold">${results.data.portfolio.npv.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total DV01</p>
                  <p className="text-2xl font-bold">${results.data.portfolio.dv01.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Gamma</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${results.data.portfolio.gamma.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-sm mt-4 text-gray-600 dark:text-gray-400">
                The portfolio has zero DV01 (delta-neutral) but positive gamma exposure from convexity adjustments
              </p>
            </div>
          </div>
        )
      
      case 'spread_analysis':
        return (
          <div>
            <h3 className="font-semibold mb-4">Futures-Swaps Spread Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Table */}
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-2">Contract</th>
                      <th className="text-right py-2">Rate Diff</th>
                      <th className="text-right py-2">Market</th>
                      <th className="text-right py-2">Impl Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.map((row: any) => (
                      <tr key={row.contract} className="border-b dark:border-gray-700">
                        <td className="py-2">{row.contract}</td>
                        <td className="text-right">{row.rate_diff.toFixed(1)}</td>
                        <td className="text-right">{row.market_spread.toFixed(1)}</td>
                        <td className="text-right">{row.implied_vol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Chart */}
              <div className="h-48">
                <Line
                  data={{
                    labels: results.data.map((r: any) => r.contract),
                    datasets: [
                      {
                        label: 'Theoretical',
                        data: results.data.map((r: any) => r.rate_diff),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      },
                      {
                        label: 'Market',
                        data: results.data.map((r: any) => r.market_spread),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' as const }
                    },
                    scales: {
                      y: {
                        title: {
                          display: true,
                          text: 'Spread (bps)'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )
      
      default:
        return <div>{JSON.stringify(results.data, null, 2)}</div>
    }
  }

  // Educational content
  function renderEducationalContent(exampleId: string) {
    switch (exampleId) {
      case 'stir_convexity':
        return (
          <ul className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
            <li>• STIR futures have daily margining while swaps settle at maturity</li>
            <li>• This creates a convexity difference that must be adjusted for</li>
            <li>• The adjustment is always negative (futures rate &gt; swap rate)</li>
            <li>• Adjustment increases with volatility and time</li>
          </ul>
        )
      
      case 'portfolio_risk':
        return (
          <ul className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
            <li>• STIR futures have zero gamma (no convexity risk)</li>
            <li>• IRS have positive gamma due to convexity adjustments</li>
            <li>• A futures/swaps portfolio can be delta-neutral but gamma-positive</li>
            <li>• This creates P&L from large rate moves (gamma trading)</li>
          </ul>
        )
      
      case 'spread_instruments':
        return (
          <ul className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
            <li>• The futures-swaps spread includes the convexity adjustment</li>
            <li>• Market spreads imply volatility expectations</li>
            <li>• Spread = Theoretical CA + Risk Premium + Supply/Demand</li>
            <li>• Spreads typically widen in volatile markets</li>
          </ul>
        )
      
      case 'curve_calibration':
        return (
          <ul className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
            <li>• Always calibrate IRS curves to swap rates, not futures rates</li>
            <li>• Apply convexity adjustments when using futures data</li>
            <li>• Adjustment accuracy impacts curve quality</li>
            <li>• Consider using market-observed futures/swaps spreads</li>
          </ul>
        )
      
      default:
        return null
    }
  }
}