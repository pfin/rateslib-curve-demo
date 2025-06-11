import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // For local development, return mock data
  // In production, this would be handled by Vercel's Python runtime
  
  const body = await request.json()
  const { curve_date, interpolation, market_data } = body
  
  // Generate mock curve response
  const dates = []
  const zeroRates = []
  const discountFactors = []
  const forwardRates = []
  
  const baseDate = new Date(curve_date)
  
  for (let days = 0; days <= 730; days += 7) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + days)
    dates.push(date.toISOString().split('T')[0])
    
    // Simple interpolation based on market data
    const years = days / 365
    let rate = 4.3
    
    if (years < 0.25) rate = 4.31
    else if (years < 1) rate = 4.31 - (4.31 - 4.09) * (years - 0.25) / 0.75
    else if (years < 2) rate = 4.09 - (4.09 - 3.79) * (years - 1)
    else rate = 3.79 + 0.1 * (years - 2)
    
    // Add variation for different interpolation methods
    if (interpolation === 'flat_forward' && days % 91 === 0) {
      rate -= 0.1
    }
    
    zeroRates.push(rate)
    discountFactors.push(1 / Math.pow(1 + rate/100, years))
    
    // Forward rate
    if (days > 0) {
      const fwdRate = rate + 0.1 * Math.sin(years * Math.PI)
      forwardRates.push(fwdRate)
    } else {
      forwardRates.push(rate)
    }
  }
  
  return NextResponse.json({
    dates,
    zero_rates: zeroRates,
    discount_factors: discountFactors,
    forward_rates: forwardRates,
    calibration: {
      success: true,
      iterations: 5,
      max_error: 0.001,
      runtime_ms: 23
    }
  })
}