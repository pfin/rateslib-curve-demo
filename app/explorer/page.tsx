'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Calendar, TrendingUp, AlertCircle, Calculator, Info, Activity, Settings, BookOpen, ChevronRight, Play, Code, LineChart } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// Official FOMC dates for 2025-2026
const FOMC_DATES = {
  2025: [
    { date: '2025-01-29', label: 'Jan 28-29', hasSEP: false },
    { date: '2025-03-19', label: 'Mar 18-19', hasSEP: true },
    { date: '2025-05-07', label: 'May 6-7', hasSEP: false },
    { date: '2025-06-18', label: 'Jun 17-18', hasSEP: true },
    { date: '2025-07-30', label: 'Jul 29-30', hasSEP: false },
    { date: '2025-09-17', label: 'Sep 16-17', hasSEP: true },
    { date: '2025-10-29', label: 'Oct 28-29', hasSEP: false },
    { date: '2025-12-10', label: 'Dec 9-10', hasSEP: true },
  ],
  2026: [
    { date: '2026-01-28', label: 'Jan 27-28', hasSEP: false },
    { date: '2026-03-18', label: 'Mar 17-18', hasSEP: true },
    { date: '2026-04-29', label: 'Apr 28-29', hasSEP: false },
    { date: '2026-06-17', label: 'Jun 16-17', hasSEP: true },
    { date: '2026-07-29', label: 'Jul 28-29', hasSEP: false },
    { date: '2026-09-16', label: 'Sep 15-16', hasSEP: true },
    { date: '2026-10-28', label: 'Oct 27-28', hasSEP: false },
    { date: '2026-12-09', label: 'Dec 8-9', hasSEP: true },
  ]
}

// Example configurations from rateslib cookbook
const COOKBOOK_EXAMPLES = [
  {
    id: 'sofr_curve',
    title: 'Building a SOFR Curve',
    description: 'Construct a complete USD SOFR curve from market data',
    category: 'curves',
    difficulty: 'beginner',
    code: `# Build SOFR curve with rateslib
import rateslib as rl
from datetime import datetime as dt

# Market data (as of June 10, 2025)
tenors = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y']
rates = [4.31, 4.32, 4.27, 4.09, 3.79, 3.73, 3.95]

# Create instruments
instruments = []
for tenor, rate in zip(tenors, rates):
    swap = rl.IRS(
        effective=dt(2025, 6, 12),  # T+2
        termination=tenor,
        spec="usd_irs",
        curves="sofr"
    )
    instruments.append(swap)

# Build curve
curve = rl.Curve(
    nodes={dt(2025, 6, 10): 1.0},
    id="sofr",
    interpolation="log_linear"
)

# Solve
solver = rl.Solver(
    curves=[curve],
    instruments=instruments,
    s=rates
)`
  },
  {
    id: 'fomc_turns',
    title: 'FOMC Dates and Turn Effects',
    description: 'Handle rate step changes at Federal Reserve meetings',
    category: 'curves',
    difficulty: 'intermediate',
    code: `# Handle FOMC turns with CompositeCurve
import rateslib as rl
from datetime import datetime as dt

# FOMC dates in 2025
fomc_dates = [
    dt(2025, 1, 29), dt(2025, 3, 19),
    dt(2025, 5, 7), dt(2025, 6, 18),
    dt(2025, 7, 30), dt(2025, 9, 17)
]

# Create CompositeCurve
curve = rl.CompositeCurve(
    curves=[
        # Short end: flat forward
        rl.Curve(
            nodes=fomc_nodes,
            interpolation="flat_forward",
            t=[None, dt(2026, 6, 10)]
        ),
        # Long end: smooth
        rl.Curve(
            nodes=long_nodes,
            interpolation="log_linear",
            t=[dt(2026, 6, 10), None]
        )
    ]
)`
  },
  {
    id: 'convexity_adjustment',
    title: 'Convexity Adjustments',
    description: 'Calculate futures/swaps convexity adjustments',
    category: 'risk',
    difficulty: 'advanced',
    code: `# STIR Convexity Adjustment
import rateslib as rl
import numpy as np

def convexity_adjustment(
    futures_rate: float,
    time_to_expiry: float,
    time_to_maturity: float,
    volatility: float
) -> float:
    """
    Calculate convexity adjustment
    CA = -0.5 * σ² * T1 * T2
    """
    adjustment = -0.5 * (volatility/100)**2 * \
                 time_to_expiry * time_to_maturity
    
    return adjustment * 10000  # in bps

# Example: 3M SOFR future
futures_rate = 4.25  # %
T1 = 0.5  # 6 months to expiry
T2 = 0.75  # 9 months to maturity
vol = 75  # bps annualized

ca = convexity_adjustment(futures_rate, T1, T2, vol)
swap_rate = futures_rate - ca/100

print(f"Futures Rate: {futures_rate:.3f}%")
print(f"Convexity Adj: {ca:.1f} bps")
print(f"Swap Rate: {swap_rate:.3f}%")`
  },
  {
    id: 'sofr_compounding',
    title: 'SOFR Daily Compounding',
    description: 'Calculate compounded SOFR rates with lookback',
    category: 'instruments',
    difficulty: 'beginner',
    code: `# SOFR Compounding Calculation
import rateslib as rl
import pandas as pd
from datetime import datetime as dt, timedelta

# Create SOFR fixing series
dates = pd.date_range('2025-01-01', '2025-01-31', freq='B')
fixings = pd.Series(
    index=dates,
    data=np.random.normal(4.30, 0.05, len(dates))
)

# Create SOFR OIS with lookback
ois = rl.IRS(
    effective=dt(2025, 1, 15),
    termination="3M",
    frequency="Q",
    convention="Act360",
    leg2_index_base="SOFR",
    leg2_fixing_method="rfr_lockout",
    leg2_lockout=2,  # 2-day lockout
    leg2_spread_compound_method="none_simple"
)

# Calculate compounded rate
period = ois.leg2.periods[0]
compounded_rate = period.rate(curve, fixings=fixings)`
  },
  {
    id: 'cross_currency',
    title: 'Cross-Currency Basis',
    description: 'Build USD/EUR cross-currency basis curves',
    category: 'curves',
    difficulty: 'advanced',
    code: `# Cross-Currency Basis Swap
import rateslib as rl

# Create EURUSD xccy basis swap
xccy = rl.XCS(
    effective=dt(2025, 6, 12),
    termination="5Y",
    spec="eurusd_xcs",
    leg1_currency="usd",
    leg2_currency="eur",
    leg1_fixed_rate=False,  # USD float
    leg2_fixed_rate=False,  # EUR float
    leg2_spread=-15.5,  # -15.5 bps
    notional=10_000_000,
    fx_fixings=1.0850  # EURUSD spot
)

# Multicurrency curve setup
usd_curve = rl.Curve(id="sofr", currency="usd")
eur_curve = rl.Curve(id="estr", currency="eur")
eurusd_curve = rl.Curve(id="eurusd", currency="eur")

# FX rates
fx = rl.FXRates({"eurusd": 1.0850})

# Solve multicurrency system
solver = rl.Solver(
    curves=[usd_curve, eur_curve, eurusd_curve],
    instruments=[...],  # USD, EUR, and XCS instruments
    fx=fx
)`
  },
  {
    id: 'bond_futures',
    title: 'Bond Futures DV01',
    description: 'Calculate CTD and futures risk',
    category: 'risk',
    difficulty: 'intermediate',
    code: `# Bond Futures Analysis
import rateslib as rl

# Create bond future
ust_future = rl.BondFuture(
    delivery=(dt(2025, 9, 1), dt(2025, 9, 30)),
    basket=[
        "912810TM0",  # 2.875% Feb 2032
        "912810TN8",  # 3.000% May 2032
        "912810TP3",  # 3.125% Aug 2032
    ],
    nominal=100_000,
    contracts=10
)

# Find CTD
ctd_analysis = ust_future.ctd_table(
    curves={"ust": treasury_curve}
)

# Calculate DV01
dv01 = ust_future.dv01(curves)
print(f"Futures DV01: $\\{dv01:,.2f\\}")

# Basis analysis
for bond in ctd_analysis:
    basis = bond['futures_price'] - bond['adj_price']
    print(f"\\{bond[\\'id\\']\\}: Basis = \\{basis:.3f\\}")`
  }
]

interface CurvePoint {
  date: string
  forward_rate: number
  zero_rate?: number
}

interface ConvexityData {
  maturity: string
  dv01: number
  convexity: number
  convexity_adjustment_bps: number
}

export default function RateslibExplorer() {
  // State management
  const [activeExample, setActiveExample] = useState(COOKBOOK_EXAMPLES[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  
  // UI state
  const [showCode, setShowCode] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  // Filter examples by category
  const filteredExamples = COOKBOOK_EXAMPLES.filter(
    ex => selectedCategory === 'all' || ex.category === selectedCategory
  )

  // Run example
  const runExample = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          example_id: activeExample.id,
          code: activeExample.code
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResults(data)
    } catch (error: any) {
      console.error('Error running example:', error)
      setError(`Failed to run example: ${error.message}`)
      
      // For demo, show mock results
      setResults(getMockResults(activeExample.id))
    }
    
    setLoading(false)
  }, [activeExample])

  // Get mock results for demo
  function getMockResults(exampleId: string) {
    switch (exampleId) {
      case 'sofr_curve':
        return {
          type: 'curve',
          data: {
            dates: ['2025-06-10', '2025-07-10', '2025-09-10', '2025-12-10', '2026-06-10', '2027-06-10', '2030-06-10'],
            zero_rates: [4.31, 4.32, 4.30, 4.25, 4.09, 3.85, 3.95],
            forward_rates: [4.31, 4.33, 4.28, 4.15, 3.77, 3.45, 4.15]
          }
        }
      case 'fomc_turns':
        return {
          type: 'fomc_analysis',
          data: {
            meeting_impacts: [
              { date: '2025-01-29', before: 4.35, after: 4.10, change: -25 },
              { date: '2025-03-19', before: 4.10, after: 3.85, change: -25 },
              { date: '2025-05-07', before: 3.85, after: 3.85, change: 0 },
              { date: '2025-06-18', before: 3.85, after: 3.60, change: -25 }
            ]
          }
        }
      case 'convexity_adjustment':
        return {
          type: 'convexity',
          data: {
            futures_rate: 4.25,
            adjustment_bps: 3.5,
            swap_rate: 4.215,
            details: {
              time_to_expiry: 0.5,
              time_to_maturity: 0.75,
              volatility: 75
            }
          }
        }
      default:
        return { type: 'text', data: 'Example completed successfully' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rateslib Interactive Explorer</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Learn fixed income analytics with real examples</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Info className="h-4 w-4" />
              <span>Powered by rateslib 2.0.0</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Example List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4">Examples</h2>
              
              {/* Category Filter */}
              <div className="mb-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                >
                  <option value="all">All Categories</option>
                  <option value="curves">Curve Building</option>
                  <option value="instruments">Instruments</option>
                  <option value="risk">Risk & Analytics</option>
                </select>
              </div>

              {/* Example List */}
              <div className="space-y-2">
                {filteredExamples.map((example) => (
                  <button
                    key={example.id}
                    onClick={() => setActiveExample(example)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeExample.id === example.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{example.title}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {example.description}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 mt-0.5 flex-shrink-0 transition-transform ${
                        activeExample.id === example.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        example.difficulty === 'beginner' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : example.difficulty === 'intermediate'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {example.difficulty}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {example.category}
                      </span>
                    </div>
                  </button>
                ))}
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
                </div>
                <button
                  onClick={runExample}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
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
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-4 w-4" />
                    <span>Output</span>
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
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                    <p className="text-red-800 dark:text-red-200">❌ {error}</p>
                  </div>
                )}
                
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Running example...</p>
                    </div>
                  </div>
                )}

                {results && !loading && (
                  <div>
                    {renderResults(results)}
                  </div>
                )}

                {!results && !loading && !error && (
                  <div className="text-center py-12 text-gray-500">
                    Click &quot;Run Example&quot; to see the output
                  </div>
                )}
              </div>
            )}

            {/* Educational Notes */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                💡 Key Concepts
              </h3>
              {renderEducationalNotes(activeExample.id)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render results based on type
  function renderResults(results: any) {
    switch (results.type) {
      case 'curve':
        return (
          <div>
            <h3 className="font-semibold mb-4">Curve Output</h3>
            <div className="h-64">
              <Line 
                data={{
                  labels: results.data.dates,
                  datasets: [
                    {
                      label: 'Zero Rates',
                      data: results.data.zero_rates,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    },
                    {
                      label: '3M Forward Rates',
                      data: results.data.forward_rates,
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
                  }
                }}
              />
            </div>
          </div>
        )
      
      case 'fomc_analysis':
        return (
          <div>
            <h3 className="font-semibold mb-4">FOMC Meeting Impacts</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2">Meeting Date</th>
                  <th className="text-right py-2">Before (%)</th>
                  <th className="text-right py-2">After (%)</th>
                  <th className="text-right py-2">Change (bps)</th>
                </tr>
              </thead>
              <tbody>
                {results.data.meeting_impacts.map((meeting: any) => (
                  <tr key={meeting.date} className="border-b dark:border-gray-700">
                    <td className="py-2">{meeting.date}</td>
                    <td className="text-right">{meeting.before.toFixed(2)}</td>
                    <td className="text-right">{meeting.after.toFixed(2)}</td>
                    <td className={`text-right font-semibold ${
                      meeting.change < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {meeting.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      
      case 'convexity':
        return (
          <div>
            <h3 className="font-semibold mb-4">Convexity Adjustment Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Futures Rate</p>
                <p className="text-2xl font-bold">{results.data.futures_rate.toFixed(3)}%</p>
              </div>
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Adjustment</p>
                <p className="text-2xl font-bold text-red-600">
                  -{results.data.adjustment_bps.toFixed(1)} bps
                </p>
              </div>
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Swap Rate</p>
                <p className="text-2xl font-bold">{results.data.swap_rate.toFixed(3)}%</p>
              </div>
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Parameters</p>
                <p className="text-sm">
                  T1: {results.data.details.time_to_expiry}y<br/>
                  T2: {results.data.details.time_to_maturity}y<br/>
                  σ: {results.data.details.volatility} bps
                </p>
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div>
            <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(results.data, null, 2)}
            </pre>
          </div>
        )
    }
  }

  // Render educational notes
  function renderEducationalNotes(exampleId: string) {
    switch (exampleId) {
      case 'sofr_curve':
        return (
          <ul className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
            <li>• SOFR (Secured Overnight Financing Rate) replaced LIBOR as the USD risk-free rate</li>
            <li>• Rateslib&apos;s Solver automatically calibrates curves to match market prices</li>
            <li>• Log-linear interpolation preserves positivity of discount factors</li>
            <li>• Always use T+2 settlement for USD swaps</li>
          </ul>
        )
      
      case 'fomc_turns':
        return (
          <ul className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
            <li>• FOMC meetings create discrete jumps in forward rates</li>
            <li>• CompositeCurve allows different interpolation for short/long end</li>
            <li>• Flat-forward interpolation correctly handles rate steps</li>
            <li>• Always include FOMC dates as curve nodes</li>
          </ul>
        )
      
      case 'convexity_adjustment':
        return (
          <ul className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
            <li>• Futures settle daily while swaps settle at maturity</li>
            <li>• Convexity adjustment = -0.5 × σ² × T1 × T2</li>
            <li>• Adjustment is always negative (futures &gt; swaps)</li>
            <li>• Effect increases with volatility and time</li>
          </ul>
        )
      
      default:
        return (
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This example demonstrates advanced features of rateslib. 
            Try modifying the code to experiment with different parameters.
          </p>
        )
    }
  }
}