import { NextRequest, NextResponse } from 'next/server'

// For local development, we'll simulate the Python serverless function
// In production on Vercel, the Python functions in /api will be used

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    // In production, this would call the Python serverless function
    // For now, return mock data that demonstrates the concept
    
    const dates = []
    const smoothForwards = []
    const compositeForwards = []
    
    const startDate = new Date(data.curve_date || '2024-01-15')
    
    // Generate 180 days of forward rates
    for (let i = 0; i < 180; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
      
      // Smooth curve - gradual decline
      const smoothRate = 5.33 - (i / 180) * 0.63
      smoothForwards.push(smoothRate)
      
      // Composite curve - step changes at FOMC dates
      let compositeRate = 5.33
      const dateStr = date.toISOString().split('T')[0]
      
      if (dateStr >= '2024-03-20') compositeRate -= 0.25  // March FOMC
      if (dateStr >= '2024-06-12') compositeRate -= 0.25  // June FOMC
      if (dateStr >= '2024-09-18') compositeRate -= 0.25  // September FOMC
      
      compositeForwards.push(compositeRate)
    }
    
    return NextResponse.json({
      smooth: {
        status: 'SUCCESS',
        iterations: 6,
        forwards: smoothForwards
      },
      composite: {
        status: 'SUCCESS',
        iterations: 8,
        forwards: compositeForwards
      },
      dates: dates,
      fomc_dates: data.fomc_dates || []
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to build curves' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}