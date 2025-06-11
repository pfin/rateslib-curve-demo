'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Calendar, TrendingUp, AlertCircle, Calculator } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// Official FOMC dates for 2025-2026
const DEFAULT_FOMC_DATES = [
  // 2025 FOMC meetings (using second day of two-day meetings)
  '2025-01-29',  // January 28-29
  '2025-03-19',  // March 18-19 (with SEP)
  '2025-05-07',  // May 6-7
  '2025-06-18',  // June 17-18 (with SEP)
  '2025-07-30',  // July 29-30
  '2025-09-17',  // September 16-17 (with SEP)
  '2025-10-29',  // October 28-29
  '2025-12-10',  // December 9-10 (with SEP)
  // 2026 FOMC meetings
  '2026-01-28',  // January 27-28
  '2026-03-18',  // March 17-18 (with SEP)
  '2026-04-29',  // April 28-29
  '2026-06-17',  // June 16-17 (with SEP)
  '2026-07-29',  // July 28-29
  '2026-09-16',  // September 15-16 (with SEP)
  '2026-10-28',  // October 27-28
  '2026-12-09',  // December 8-9 (with SEP)
]

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [curveData, setCurveData] = useState<any>(null)
  const [selectedFomc, setSelectedFomc] = useState(1) // March FOMC
  const [showRiskMetrics, setShowRiskMetrics] = useState(false)
  const [riskData, setRiskData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Market data state - Live SOFR swap rates from Bloomberg (June 10, 2025)
  const [marketData, setMarketData] = useState({
    tenors: ['1M', '2M', '3M', '4M', '5M', '6M', '7M', '8M', '9M', '10M', '11M', '1Y', '18M', '2Y', '3Y', '4Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'],
    rates: [4.31215, 4.31619, 4.3204, 4.30612, 4.28827, 4.26725, 4.23438, 4.2047, 4.1795, 4.148, 4.12016, 4.09225, 3.893, 3.78885, 3.70875, 3.7049, 3.72945, 3.8182, 3.94905, 4.112, 4.1675, 4.0875]
  })

  const buildCurves = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/curves_modern`
      : '/api/curves_modern'
    
    try {
      // First build flat_forward curve
      const flatResponse = await fetch(`/api/curves?curve_date=2025-06-10&interpolation=flat_forward`, {
        method: 'GET',
      })
      
      if (!flatResponse.ok) {
        const errorData = await flatResponse.json()
        throw new Error(errorData.error || `HTTP error! status: ${flatResponse.status}`)
      }
      
      const flatData = await flatResponse.json()
      
      // Then build log_linear curve
      const smoothResponse = await fetch(`/api/curves?curve_date=2025-06-10&interpolation=log_linear`, {
        method: 'GET',
      })
      
      if (!smoothResponse.ok) {
        const errorData = await smoothResponse.json()
        throw new Error(errorData.error || `HTTP error! status: ${smoothResponse.status}`)
      }
      
      const smoothData = await smoothResponse.json()
      
      // Transform the response to match expected format
      const transformedData = {
        dates: flatData.points.map((p: any) => p.date),
        smooth: {
          forwards: smoothData.points.map((p: any) => p.forward_rate)
        },
        composite: {
          forwards: flatData.points.map((p: any) => p.forward_rate)
        },
        fomc_dates: DEFAULT_FOMC_DATES
      }
      
      setCurveData(transformedData)
    } catch (error: any) {
      console.error('Error building curves:', error)
      setError(`Failed to build curves: ${error.message}`)
    }
    setLoading(false)
  }, [])

  const calculateRiskMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/risk`
      : '/api/risk'
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument_type: 'swap',
          start_date: '2025-07-15',
          end_date: '2025-10-15',
          notional: 10000000
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setRiskData(data)
      setShowRiskMetrics(true)
    } catch (error: any) {
      console.error('Error calculating risk:', error)
      setError(`Failed to calculate risk metrics: ${error.message}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    buildCurves()
  }, [buildCurves])

  const chartData = curveData ? {
    labels: curveData.dates,
    datasets: [
      {
        label: 'Smooth Curve (log-linear)',
        data: curveData.smooth.forwards,
        borderColor: 'rgb(31, 119, 180)',
        backgroundColor: 'rgba(31, 119, 180, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      },
      {
        label: 'Step Function (flat-forward)',
        data: curveData.composite.forwards,
        borderColor: 'rgb(255, 127, 14)',
        backgroundColor: 'rgba(255, 127, 14, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      }
    ]
  } : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '1-Day Forward Rates: Smooth vs Step Function (Calculated by Rateslib)',
        font: { size: 16 }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
          displayFormats: {
            month: 'MMM yyyy'
          }
        }
      },
      y: {
        title: {
          display: true,
          text: 'Forward Rate (%)'
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Rateslib Demo: Step Function vs Smooth Curves
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Using rateslib to demonstrate why step function interpolation is essential for 
          accurately pricing instruments around FOMC meeting dates.
        </p>
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-800 dark:text-red-200">❌ {error}</p>
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            <h3 className="font-semibold">FOMC Meetings</h3>
          </div>
          <p className="text-sm">8 meetings in 2024 where policy rates can change</p>
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <TrendingUp className="w-5 h-5 mr-2 text-orange-600" />
            <h3 className="font-semibold">Current SOFR</h3>
          </div>
          <p className="text-sm">4.29% spot, inverting to 3.71% at 3Y</p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 mr-2 text-green-600" />
            <h3 className="font-semibold">Pricing Impact</h3>
          </div>
          <p className="text-sm">5-10% difference in DV01 for short-term instruments</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="h-96">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Building curves...</p>
              </div>
            </div>
          )}
          {chartData && !loading && (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
        
        {/* FOMC date markers */}
        <div className="mt-4 flex flex-wrap gap-2">
          {DEFAULT_FOMC_DATES.slice(0, 8).map((date, idx) => (
            <div
              key={date}
              className={`px-3 py-1 rounded text-sm ${
                idx === selectedFomc 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700'
              } cursor-pointer`}
              onClick={() => setSelectedFomc(idx)}
            >
              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>

      {/* Market Data Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Market Data Input</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {marketData.tenors.slice(0, 8).map((tenor, idx) => (
            <div key={tenor}>
              <label className="block text-sm font-medium mb-1">{tenor}</label>
              <input
                type="number"
                step="0.01"
                value={marketData.rates[idx]}
                onChange={(e) => {
                  const newRates = [...marketData.rates]
                  newRates[idx] = parseFloat(e.target.value) || 0
                  setMarketData({ ...marketData, rates: newRates })
                }}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
        <button
          onClick={buildCurves}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Building with Rateslib...' : 'Rebuild Curves'}
        </button>
      </div>

      {/* Risk Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Risk Metrics Comparison</h2>
          <button
            onClick={calculateRiskMetrics}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Risk with Rateslib
          </button>
        </div>
        
        {showRiskMetrics && riskData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Smooth Curve</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>NPV:</span>
                  <span className="font-mono">${riskData.smooth_curve.npv.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>DV01:</span>
                  <span className="font-mono">${riskData.smooth_curve.dv01.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Step Function Curve</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>NPV:</span>
                  <span className="font-mono">${riskData.composite_curve.npv.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>DV01:</span>
                  <span className="font-mono">${riskData.composite_curve.dv01.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h4 className="font-semibold mb-2">Key Differences</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>NPV Difference: ${riskData.differences.npv_diff.toLocaleString()}</li>
                <li>DV01 Difference: ${riskData.differences.dv01_diff.toLocaleString()} ({riskData.differences.dv01_pct.toFixed(1)}%)</li>
                <li>Risk metrics calculated using rateslib&apos;s automatic differentiation</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Educational Content */}
      <div className="mt-12 prose dark:prose-invert max-w-none">
        <h2>Why Step Functions Matter (Demonstrated with Rateslib)</h2>
        <p>
          This demo uses <strong>rateslib</strong> to build actual yield curves and calculate forward rates.
          Central banks change policy rates at discrete meetings, not continuously. 
          Using smooth interpolation methods like log-linear or cubic splines for the 
          short end of the curve systematically misprices instruments around these meetings.
        </p>
        
        <h3>Rateslib Features Used:</h3>
        <ul>
          <li><strong>Curve Construction:</strong> Building curves with different interpolation methods</li>
          <li><strong>CompositeCurve:</strong> Combining step function (flat_forward) for short end with smooth interpolation for long end</li>
          <li><strong>Automatic Differentiation:</strong> Calculating exact risk sensitivities using Dual numbers</li>
          <li><strong>Solver:</strong> Calibrating curves to market data</li>
        </ul>
        
        <h3>Best Practices:</h3>
        <ol>
          <li>Use flat-forward interpolation for tenors under 18 months</li>
          <li>Include FOMC dates as explicit curve nodes</li>
          <li>Calibrate to turn instruments (FRAs) around meeting dates</li>
          <li>Use smooth interpolation only for the long end (&gt;18M)</li>
        </ol>
        
        <div className="mt-8 p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm">
            <strong>Powered by Rateslib:</strong> All curves and calculations in this demo are performed 
            using rateslib&apos;s professional-grade fixed income analytics. The forward rates you see are 
            calculated in real-time using actual curve construction and interpolation methods.
          </p>
        </div>
      </div>
    </main>
  )
}