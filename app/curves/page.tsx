'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { TrendingUp, Calendar, Settings, Layers, AlertCircle, Play, Code, Download, Upload } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// Interpolation methods available in rateslib
const INTERPOLATION_METHODS = [
  { id: 'flat_forward', name: 'Flat Forward', description: 'Step function - ideal for short end' },
  { id: 'flat_backward', name: 'Flat Backward', description: 'Step function looking backward' },
  { id: 'linear', name: 'Linear', description: 'Linear interpolation on discount factors' },
  { id: 'linear_zero_rate', name: 'Linear Zero Rate', description: 'Linear interpolation on zero rates' },
  { id: 'log_linear', name: 'Log Linear', description: 'Log-linear interpolation - preserves positivity' },
  { id: 'log_cubic', name: 'Log Cubic', description: 'Smooth cubic spline on log of discount factors' },
  { id: 'null', name: 'Null', description: 'No interpolation - only exact nodes' },
]

// Default market data
const DEFAULT_MARKET_DATA = [
  { tenor: '1M', rate: 4.31, active: true },
  { tenor: '3M', rate: 4.32, active: true },
  { tenor: '6M', rate: 4.27, active: true },
  { tenor: '1Y', rate: 4.09, active: true },
  { tenor: '2Y', rate: 3.79, active: true },
  { tenor: '3Y', rate: 3.71, active: true },
  { tenor: '5Y', rate: 3.73, active: true },
  { tenor: '7Y', rate: 3.82, active: true },
  { tenor: '10Y', rate: 3.95, active: true },
  { tenor: '15Y', rate: 4.11, active: true },
  { tenor: '20Y', rate: 4.17, active: true },
  { tenor: '30Y', rate: 4.09, active: true },
]

// FOMC dates
const FOMC_DATES = [
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
  '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10'
]

export default function CurveBuilder() {
  const [marketData, setMarketData] = useState(DEFAULT_MARKET_DATA)
  const [interpolation, setInterpolation] = useState('log_linear')
  const [curveDate, setCurveDate] = useState('2025-06-10')
  const [showFomcNodes, setShowFomcNodes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [curveData, setCurveData] = useState<any>(null)
  const [showCode, setShowCode] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Advanced settings
  const [convention, setConvention] = useState('Act360')
  const [calendar, setCalendar] = useState('nyc')
  const [spotLag, setSpotLag] = useState(2)

  // Generate mock curve data
  const generateMockCurve = useCallback(() => {
    const dates = []
    const zeroRates = []
    const discountFactors = []
    const forwardRates = []
    
    const baseDate = new Date(curveDate)
    const activeData = marketData.filter(d => d.active)
    
    // Generate daily points for 2 years
    for (let days = 0; days <= 730; days += 7) {
      const date = new Date(baseDate)
      date.setDate(date.getDate() + days)
      dates.push(date.toISOString().split('T')[0])
      
      // Simple interpolation for demo
      const years = days / 365
      let rate = 4.3 // Start rate
      
      if (years < 0.25) rate = 4.31
      else if (years < 1) rate = 4.31 - (4.31 - 4.09) * (years - 0.25) / 0.75
      else if (years < 2) rate = 4.09 - (4.09 - 3.79) * (years - 1)
      else rate = 3.79 + 0.1 * (years - 2)
      
      // Add some variation based on interpolation method
      if (interpolation === 'flat_forward' && days % 30 === 0) {
        rate += Math.random() * 0.05 - 0.025
      }
      
      zeroRates.push(rate)
      discountFactors.push(1 / Math.pow(1 + rate/100, years))
      
      // Forward rate (simplified)
      if (days > 0) {
        const fwdRate = rate + 0.1 * Math.sin(years * Math.PI)
        forwardRates.push(fwdRate)
      } else {
        forwardRates.push(rate)
      }
    }
    
    setCurveData({
      dates,
      zero_rates: zeroRates,
      discount_factors: discountFactors,
      forward_rates: forwardRates,
      calibration: {
        success: true,
        iterations: 5,
        max_error: 0.01,
        runtime_ms: 23
      }
    })
  }, [curveDate, marketData, interpolation])

  // Build curve
  const buildCurve = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Filter active instruments
      const activeData = marketData.filter(d => d.active)
      
      const response = await fetch('/api/curves/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curve_date: curveDate,
          interpolation,
          market_data: activeData.map(d => ({ tenor: d.tenor, rate: d.rate })),
          convention,
          calendar,
          spot_lag: spotLag,
          include_fomc: showFomcNodes
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setCurveData(data)
    } catch (err: any) {
      console.error('Error building curve:', err)
      setError(err.message)
      
      // Generate mock data for demo
      generateMockCurve()
    } finally {
      setLoading(false)
    }
  }, [marketData, interpolation, curveDate, convention, calendar, spotLag, showFomcNodes, generateMockCurve])

  // Generate code
  const generateCode = () => {
    const activeData = marketData.filter(d => d.active)
    return `import rateslib as rl
from datetime import datetime as dt

# Market data
tenors = [${activeData.map(d => `'${d.tenor}'`).join(', ')}]
rates = [${activeData.map(d => d.rate.toFixed(2)).join(', ')}]

# Create instruments
instruments = []
for tenor, rate in zip(tenors, rates):
    swap = rl.IRS(
        effective=dt(${curveDate.replace(/-/g, ', ')}),
        termination=tenor,
        frequency="Q" if tenor in ['1M', '3M', '6M'] else "S",
        convention="${convention}",
        fixed_rate=rate,
        leg2_index_base="SOFR",
        notional=10_000_000,
        curves="sofr"
    )
    instruments.append(swap)

# Build curve
curve = rl.Curve(
    nodes={dt(${curveDate.replace(/-/g, ', ')}): 1.0},
    id="sofr",
    interpolation="${interpolation}",
    convention="${convention}",
    calendar="${calendar}"
)

# Add nodes
for inst in instruments:
    curve.nodes[inst.termination] = 1.0

${showFomcNodes ? `# Add FOMC nodes
fomc_dates = [
${FOMC_DATES.map(d => `    dt(${d.replace(/-/g, ', ')})`).join(',\n')}
]
for fomc_date in fomc_dates:
    if fomc_date > dt(${curveDate.replace(/-/g, ', ')}):
        curve.nodes[fomc_date] = 1.0\n` : ''}

# Solve
solver = rl.Solver(
    curves=[curve],
    instruments=instruments,
    s=rates
)

print(f"Calibration successful: {solver.result['success']}")
print(f"Max error: {max(abs(solver.result['fun']))*10000:.2f} bps")`
  }

  // Export curve data
  const exportData = () => {
    if (!curveData) return
    
    const exportObj = {
      metadata: {
        curve_date: curveDate,
        interpolation,
        convention,
        calendar,
        generated_at: new Date().toISOString()
      },
      market_data: marketData.filter(d => d.active),
      curve_data: curveData
    }
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sofr_curve_${curveDate}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Initial build
  useEffect(() => {
    buildCurve()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Interactive Curve Builder
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Build and visualize yield curves with rateslib
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCode(!showCode)}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              >
                <Code className="h-4 w-4" />
                <span>{showCode ? 'Hide' : 'Show'} Code</span>
              </button>
              <button
                onClick={exportData}
                disabled={!curveData}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Curve Settings
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Curve Date
                  </label>
                  <input
                    type="date"
                    value={curveDate}
                    onChange={(e) => setCurveDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Interpolation Method
                  </label>
                  <select
                    value={interpolation}
                    onChange={(e) => setInterpolation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  >
                    {INTERPOLATION_METHODS.map(method => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {INTERPOLATION_METHODS.find(m => m.id === interpolation)?.description}
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="fomc-nodes"
                    checked={showFomcNodes}
                    onChange={(e) => setShowFomcNodes(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="fomc-nodes" className="text-sm">
                    Include FOMC meeting dates as nodes
                  </label>
                </div>
                
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showAdvanced ? 'Hide' : 'Show'} advanced settings
                </button>
                
                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Day Count Convention
                      </label>
                      <select
                        value={convention}
                        onChange={(e) => setConvention(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="Act360">Act/360</option>
                        <option value="Act365">Act/365</option>
                        <option value="30360">30/360</option>
                        <option value="ActAct">Act/Act</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Calendar
                      </label>
                      <select
                        value={calendar}
                        onChange={(e) => setCalendar(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="nyc">NYC (FED)</option>
                        <option value="ldn">London</option>
                        <option value="tgt">TARGET</option>
                        <option value="tyo">Tokyo</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Spot Lag (days)
                      </label>
                      <input
                        type="number"
                        value={spotLag}
                        onChange={(e) => setSpotLag(parseInt(e.target.value) || 2)}
                        min="0"
                        max="5"
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={buildCurve}
                disabled={loading}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>{loading ? 'Building...' : 'Build Curve'}</span>
              </button>
            </div>
            
            {/* Market Data */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                Market Data
              </h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {marketData.map((data, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={data.active}
                      onChange={(e) => {
                        const newData = [...marketData]
                        newData[idx].active = e.target.checked
                        setMarketData(newData)
                      }}
                      className="flex-shrink-0"
                    />
                    <span className="w-12 text-sm font-mono">{data.tenor}</span>
                    <input
                      type="number"
                      value={data.rate}
                      onChange={(e) => {
                        const newData = [...marketData]
                        newData[idx].rate = parseFloat(e.target.value) || 0
                        setMarketData(newData)
                      }}
                      step="0.01"
                      className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                      disabled={!data.active}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}
            
            {/* Code View */}
            {showCode && (
              <div className="bg-gray-900 rounded-lg shadow p-6">
                <h3 className="text-white font-semibold mb-4">Rateslib Code</h3>
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  <code>{generateCode()}</code>
                </pre>
              </div>
            )}
            
            {/* Charts */}
            {curveData && !showCode && (
              <>
                {/* Zero Rates Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Zero Rates</h3>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: curveData.dates,
                        datasets: [{
                          label: 'Zero Rate',
                          data: curveData.zero_rates,
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          borderWidth: 2,
                          pointRadius: 0,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.parsed.y.toFixed(3)}%`
                            }
                          }
                        },
                        scales: {
                          x: {
                            type: 'time',
                            time: { unit: 'month' }
                          },
                          y: {
                            title: {
                              display: true,
                              text: 'Rate (%)'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Forward Rates Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">1-Day Forward Rates</h3>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: curveData.dates,
                        datasets: [{
                          label: 'Forward Rate',
                          data: curveData.forward_rates,
                          borderColor: 'rgb(239, 68, 68)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderWidth: 2,
                          pointRadius: 0,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.parsed.y.toFixed(3)}%`
                            }
                          }
                        },
                        scales: {
                          x: {
                            type: 'time',
                            time: { unit: 'month' }
                          },
                          y: {
                            title: {
                              display: true,
                              text: 'Rate (%)'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  {showFomcNodes && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {FOMC_DATES.map(date => (
                        <span key={date} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Calibration Info */}
                {curveData.calibration && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Calibration Results</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p className="font-semibold">
                          {curveData.calibration.success ? (
                            <span className="text-green-600">✓ Success</span>
                          ) : (
                            <span className="text-red-600">✗ Failed</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Iterations</p>
                        <p className="font-semibold">{curveData.calibration.iterations}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Max Error</p>
                        <p className="font-semibold">{(curveData.calibration.max_error * 10000).toFixed(2)} bps</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Runtime</p>
                        <p className="font-semibold">{curveData.calibration.runtime_ms} ms</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Loading State */}
            {loading && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Building curve with rateslib...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}