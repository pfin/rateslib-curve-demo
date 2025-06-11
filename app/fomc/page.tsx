'use client'

import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, BarElement } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Calendar, TrendingDown, TrendingUp, AlertCircle, Info, Clock, Target } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale)

// FOMC meeting data for 2025-2026
const FOMC_MEETINGS = [
  // 2025
  { date: '2025-01-29', label: 'Jan 28-29', hasSEP: false, marketExpectation: -25 },
  { date: '2025-03-19', label: 'Mar 18-19', hasSEP: true, marketExpectation: -25 },
  { date: '2025-05-07', label: 'May 6-7', hasSEP: false, marketExpectation: 0 },
  { date: '2025-06-18', label: 'Jun 17-18', hasSEP: true, marketExpectation: -25 },
  { date: '2025-07-30', label: 'Jul 29-30', hasSEP: false, marketExpectation: 0 },
  { date: '2025-09-17', label: 'Sep 16-17', hasSEP: true, marketExpectation: -25 },
  { date: '2025-10-29', label: 'Oct 28-29', hasSEP: false, marketExpectation: 0 },
  { date: '2025-12-10', label: 'Dec 9-10', hasSEP: true, marketExpectation: 0 },
  // 2026  
  { date: '2026-01-28', label: 'Jan 27-28', hasSEP: false, marketExpectation: 0 },
  { date: '2026-03-18', label: 'Mar 17-18', hasSEP: true, marketExpectation: 0 },
]

// Interpolation comparison data
const INTERPOLATION_COMPARISON = [
  { 
    method: 'Flat Forward', 
    description: 'Step function - correctly models discrete rate changes',
    pros: ['Accurate FOMC pricing', 'No rate smoothing', 'Market consistent'],
    cons: ['Discontinuous forward curve', 'Less aesthetically pleasing']
  },
  { 
    method: 'Log Linear', 
    description: 'Smooth interpolation - incorrectly averages across meetings',
    pros: ['Smooth curves', 'Easy to implement', 'Good for long end'],
    cons: ['Misprices short instruments', 'Ignores meeting dates', 'Systematic errors']
  },
]

export default function FOMCAnalysis() {
  const [loading, setLoading] = useState(false)
  const [curveComparison, setCurveComparison] = useState<any>(null)
  const [selectedMeeting, setSelectedMeeting] = useState(3) // June FOMC
  const [showEducation, setShowEducation] = useState(true)
  const [currentRate, setCurrentRate] = useState(4.35)
  const [terminalRate, setTerminalRate] = useState(3.00)
  
  // Calculate cumulative rate path
  const calculateRatePath = () => {
    let rate = currentRate
    const ratePath = [{ date: '2025-06-10', rate: currentRate }]
    
    FOMC_MEETINGS.forEach(meeting => {
      if (new Date(meeting.date) > new Date('2025-06-10')) {
        rate += meeting.marketExpectation / 100
        ratePath.push({ date: meeting.date, rate })
      }
    })
    
    return ratePath
  }

  // Generate mock curve comparison
  const generateCurveComparison = () => {
    const dates = []
    const flatForward = []
    const logLinear = []
    const difference = []
    
    const baseDate = new Date('2025-06-10')
    let currentRate = 4.35
    
    // Generate daily points
    for (let days = 0; days <= 365; days += 1) {
      const date = new Date(baseDate)
      date.setDate(date.getDate() + days)
      const dateStr = date.toISOString().split('T')[0]
      dates.push(dateStr)
      
      // Find if we're past an FOMC meeting
      let ffRate = currentRate
      let cumulativeChange = 0
      
      FOMC_MEETINGS.forEach(meeting => {
        const meetingDate = new Date(meeting.date)
        if (meetingDate <= date && meetingDate > baseDate) {
          ffRate += meeting.marketExpectation / 100
          cumulativeChange += meeting.marketExpectation / 100
        }
      })
      
      flatForward.push(ffRate)
      
      // Log linear smooths the rate changes
      const yearFraction = days / 365
      const smoothRate = currentRate + cumulativeChange * yearFraction
      logLinear.push(smoothRate)
      
      // Calculate difference
      difference.push((ffRate - smoothRate) * 100) // in bps
    }
    
    setCurveComparison({
      dates,
      flatForward,
      logLinear,
      difference
    })
  }

  // Calculate meeting impact
  const calculateMeetingImpact = (meetingIndex: number) => {
    if (meetingIndex >= FOMC_MEETINGS.length) return null
    
    const meeting = FOMC_MEETINGS[meetingIndex]
    const prevRate = meetingIndex === 0 ? currentRate : 
      currentRate + FOMC_MEETINGS.slice(0, meetingIndex)
        .reduce((sum, m) => sum + m.marketExpectation / 100, 0)
    
    const newRate = prevRate + meeting.marketExpectation / 100
    
    return {
      meeting: meeting.label,
      date: meeting.date,
      hasSEP: meeting.hasSEP,
      prevRate,
      newRate,
      change: meeting.marketExpectation,
      cumulative: newRate - currentRate
    }
  }

  useEffect(() => {
    generateCurveComparison()
  }, [currentRate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  FOMC Dates and Turn Effects
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Understanding rate steps at Federal Reserve meetings
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>8 meetings per year</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Insight */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-3">
            <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Why FOMC Dates Matter for Curve Construction
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                The Federal Reserve only changes policy rates at scheduled FOMC meetings (8 per year). 
                Using smooth interpolation like log-linear for short-dated instruments systematically 
                misprices forwards around these meetings. Rateslib&apos;s CompositeCurve allows using 
                flat-forward interpolation for the short end while maintaining smooth curves for longer tenors.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Meeting Schedule */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-4">2025 FOMC Schedule</h2>
              
              <div className="space-y-2">
                {FOMC_MEETINGS.slice(0, 8).map((meeting, idx) => {
                  const impact = calculateMeetingImpact(idx)
                  const isPast = new Date(meeting.date) < new Date('2025-06-10')
                  
                  return (
                    <button
                      key={meeting.date}
                      onClick={() => setSelectedMeeting(idx)}
                      disabled={isPast}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedMeeting === idx
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                          : isPast
                          ? 'bg-gray-100 dark:bg-gray-700 opacity-50'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{meeting.label}</span>
                            {meeting.hasSEP && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                                SEP
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(meeting.date).toLocaleDateString('en-US', { 
                              weekday: 'short', month: 'short', day: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          {meeting.marketExpectation !== 0 && (
                            <div className={`flex items-center space-x-1 ${
                              meeting.marketExpectation < 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {meeting.marketExpectation < 0 ? (
                                <TrendingDown className="h-4 w-4" />
                              ) : (
                                <TrendingUp className="h-4 w-4" />
                              )}
                              <span className="font-semibold text-sm">
                                {Math.abs(meeting.marketExpectation)}bp
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span>Current Rate</span>
                  <span className="font-semibold">{currentRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Expected by Dec 2025</span>
                  <span className="font-semibold">
                    {(currentRate + FOMC_MEETINGS.slice(0, 8)
                      .reduce((sum, m) => sum + m.marketExpectation / 100, 0)).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Interpolation Methods */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Interpolation Methods</h3>
              <div className="space-y-4">
                {INTERPOLATION_COMPARISON.map((method, idx) => (
                  <div key={idx} className="border dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-1">{method.method}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {method.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-medium text-green-600 mb-1">Pros:</p>
                        <ul className="space-y-0.5">
                          {method.pros.map((pro, i) => (
                            <li key={i} className="text-gray-600 dark:text-gray-400">• {pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-red-600 mb-1">Cons:</p>
                        <ul className="space-y-0.5">
                          {method.cons.map((con, i) => (
                            <li key={i} className="text-gray-600 dark:text-gray-400">• {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meeting Impact Analysis */}
            {selectedMeeting < FOMC_MEETINGS.length && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Meeting Impact Analysis</h3>
                {(() => {
                  const impact = calculateMeetingImpact(selectedMeeting)
                  if (!impact) return null
                  
                  return (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Meeting</p>
                        <p className="font-semibold">{impact.meeting}</p>
                        {impact.hasSEP && (
                          <p className="text-xs text-purple-600 mt-1">
                            Includes Summary of Economic Projections
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Market Expectation</p>
                        <p className={`font-semibold text-2xl ${
                          impact.change < 0 ? 'text-red-600' : 
                          impact.change > 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {impact.change > 0 && '+'}{impact.change} bps
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Rate Before</p>
                        <p className="font-semibold">{impact.prevRate.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Rate After</p>
                        <p className="font-semibold">{impact.newRate.toFixed(2)}%</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
            
            {/* Forward Curve Comparison */}
            {curveComparison && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Forward Rate Curves: Flat Forward vs Log Linear</h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: curveComparison.dates.filter((_: any, i: number) => i % 7 === 0), // Weekly
                      datasets: [
                        {
                          label: 'Flat Forward (Correct)',
                          data: curveComparison.flatForward.filter((_: any, i: number) => i % 7 === 0),
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          borderWidth: 2,
                          pointRadius: 0,
                          stepped: 'before' as const,
                        },
                        {
                          label: 'Log Linear (Incorrect)',
                          data: curveComparison.logLinear.filter((_: any, i: number) => i % 7 === 0),
                          borderColor: 'rgb(239, 68, 68)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderWidth: 2,
                          pointRadius: 0,
                          borderDash: [5, 5],
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' as const },
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(3)}%`
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
                            text: 'Forward Rate (%)'
                          }
                        }
                      }
                    }}
                  />
                </div>
                
                {/* FOMC markers */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {FOMC_MEETINGS.slice(0, 8).map(meeting => (
                    <div
                      key={meeting.date}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded flex items-center space-x-1"
                    >
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      {meeting.marketExpectation !== 0 && (
                        <span className={meeting.marketExpectation < 0 ? 'text-red-600' : 'text-green-600'}>
                          ({meeting.marketExpectation > 0 ? '+' : ''}{meeting.marketExpectation})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Pricing Difference */}
            {curveComparison && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Pricing Difference (bps)</h3>
                <div className="h-48">
                  <Bar
                    data={{
                      labels: curveComparison.dates.filter((_: any, i: number) => i % 30 === 0), // Monthly
                      datasets: [{
                        label: 'Flat Forward - Log Linear',
                        data: curveComparison.difference.filter((_: any, i: number) => i % 30 === 0),
                        backgroundColor: (context) => {
                          const value = context.parsed.y
                          return value > 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(59, 130, 246, 0.8)'
                        },
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (context) => `Difference: ${context.parsed.y.toFixed(1)} bps`
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
                            text: 'Basis Points'
                          }
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  The difference shows how log-linear interpolation systematically misprices forwards 
                  around FOMC meetings. The error is largest just before meetings and reverses after.
                </p>
              </div>
            )}
            
            {/* Best Practices */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 dark:text-green-200 mb-4">
                Rateslib Best Practices for FOMC Turns
              </h3>
              <div className="space-y-3 text-sm text-green-800 dark:text-green-300">
                <div className="flex items-start space-x-2">
                  <Target className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Use CompositeCurve:</strong> Combine flat_forward for short end (&lt;18M) 
                    with log_linear for long end
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <Target className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Add FOMC nodes:</strong> Include all FOMC dates as explicit curve nodes 
                    for accurate turn pricing
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <Target className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Calibrate to turns:</strong> Use FRAs or meeting-dated OIS to pin down 
                    exact rate changes
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <Target className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Monitor basis:</strong> Track futures vs OIS basis around meetings for 
                    additional alpha
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}