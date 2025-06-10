'use client'

import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Calendar, TrendingUp, AlertCircle, Calculator } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// Default FOMC dates for 2024
const DEFAULT_FOMC_DATES = [
  '2024-01-31',
  '2024-03-20',
  '2024-05-01',
  '2024-06-12',
  '2024-07-31',
  '2024-09-18',
  '2024-11-07',
  '2024-12-18',
]

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [curveData, setCurveData] = useState<any>(null)
  const [selectedFomc, setSelectedFomc] = useState(1) // March FOMC
  const [showRiskMetrics, setShowRiskMetrics] = useState(false)
  const [riskData, setRiskData] = useState<any>(null)

  // Market data state
  const [marketData, setMarketData] = useState({
    tenors: ['1W', '2W', '1M', '2M', '3M', '4M', '5M', '6M', '9M', '1Y', '18M', '2Y', '3Y', '5Y', '7Y', '10Y'],
    rates: [5.32, 5.32, 5.31, 5.25, 5.15, 5.10, 5.05, 5.00, 4.85, 4.70, 4.50, 4.40, 4.35, 4.45, 4.55, 4.65]
  })

  const buildCurves = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/curves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curve_date: '2024-01-15',
          market_data: marketData,
          fomc_dates: DEFAULT_FOMC_DATES
        })
      })
      const data = await response.json()
      setCurveData(data)
    } catch (error) {
      console.error('Error building curves:', error)
    }
    setLoading(false)
  }

  const calculateRiskMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument_type: 'swap',
          start_date: '2024-02-15',
          end_date: '2024-05-15',
          notional: 10000000
        })
      })
      const data = await response.json()
      setRiskData(data)
      setShowRiskMetrics(true)
    } catch (error) {
      console.error('Error calculating risk:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    buildCurves()
  }, [])

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
        text: '1-Day Forward Rates: Smooth vs Step Function',
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
          Step Function vs Smooth Curves for Central Bank Policy Rates
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Interactive demonstration showing why step function interpolation is essential for 
          accurately pricing instruments around FOMC meeting dates.
        </p>
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
            <h3 className="font-semibold">Rate Expectations</h3>
          </div>
          <p className="text-sm">Market pricing 75bps of cuts by September</p>
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
          {chartData && (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
        
        {/* FOMC date markers */}
        <div className="mt-4 flex flex-wrap gap-2">
          {DEFAULT_FOMC_DATES.slice(0, 4).map((date, idx) => (
            <div
              key={date}
              className={`px-3 py-1 rounded text-sm ${
                idx === selectedFomc 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700'
              } cursor-pointer`}
              onClick={() => setSelectedFomc(idx)}
            >
              FOMC {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>

      {/* Market Data Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Market Data</h2>
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
                  newRates[idx] = parseFloat(e.target.value)
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
          {loading ? 'Building...' : 'Rebuild Curves'}
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
            Calculate Risk
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
                <li>Risk metrics can differ significantly for instruments spanning FOMC dates</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Educational Content */}
      <div className="mt-12 prose dark:prose-invert max-w-none">
        <h2>Why Step Functions Matter</h2>
        <p>
          Central banks change policy rates at discrete meetings, not continuously. 
          Using smooth interpolation methods like log-linear or cubic splines for the 
          short end of the curve systematically misprices instruments around these meetings.
        </p>
        
        <h3>Key Concepts:</h3>
        <ul>
          <li><strong>Smooth Interpolation:</strong> Averages rate changes over time, missing the discrete jumps</li>
          <li><strong>Step Function (flat-forward):</strong> Correctly models overnight rate jumps at FOMC dates</li>
          <li><strong>CompositeCurve:</strong> Combines step function for short end with smooth interpolation for long end</li>
        </ul>
        
        <h3>Best Practices:</h3>
        <ol>
          <li>Use flat-forward interpolation for tenors under 18 months</li>
          <li>Include FOMC dates as explicit curve nodes</li>
          <li>Calibrate to turn instruments (FRAs) around meeting dates</li>
          <li>Use smooth interpolation only for the long end (&gt;18M)</li>
        </ol>
      </div>
    </main>
  )
}