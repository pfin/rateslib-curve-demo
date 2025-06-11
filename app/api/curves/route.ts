import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // For local development, return mock data
  // In production, this would be handled by Vercel's Python runtime
  
  const searchParams = request.nextUrl.searchParams
  const curveDate = searchParams.get('curve_date') || '2025-06-10'
  const interpolation = searchParams.get('interpolation') || 'flat_forward'
  
  // Generate mock curve data
  const points = []
  const baseDate = new Date(curveDate)
  
  for (let days = 0; days <= 365; days += 7) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + days)
    
    // Simple mock forward rate calculation
    const years = days / 365
    let forwardRate = 4.3
    
    if (interpolation === 'flat_forward') {
      // Step function for FOMC dates
      if (years < 0.16) forwardRate = 4.35  // Until Jan FOMC
      else if (years < 0.33) forwardRate = 4.10  // Until Mar FOMC
      else if (years < 0.5) forwardRate = 3.85  // Until Jun FOMC
      else forwardRate = 3.60
    } else {
      // Smooth interpolation
      forwardRate = 4.35 - (0.75 * years)
    }
    
    points.push({
      date: date.toISOString().split('T')[0],
      forward_rate: forwardRate,
      zero_rate: days > 0 ? forwardRate - 0.05 : null
    })
  }
  
  return NextResponse.json({
    curve_date: curveDate,
    interpolation,
    points,
    metadata: {
      rateslib_version: "2.0.0",
      nodes_count: 8,
      points_generated: points.length
    }
  })
}