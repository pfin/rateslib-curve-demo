import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    // Mock risk calculations showing typical differences
    const { instrument_type, notional = 10000000 } = data
    
    let smoothDv01, compositeDv01, smoothNpv, compositeNpv
    
    if (instrument_type === 'swap') {
      // 3M swap spanning FOMC
      smoothDv01 = -2450.50
      compositeDv01 = -2315.25
      smoothNpv = 12500.00
      compositeNpv = 11875.00
    } else if (instrument_type === 'fra') {
      // 1M FRA around FOMC
      smoothDv01 = -833.33
      compositeDv01 = -825.00
      smoothNpv = -2100.00
      compositeNpv = -2250.00
    } else {
      smoothDv01 = 0
      compositeDv01 = 0
      smoothNpv = 0
      compositeNpv = 0
    }
    
    return NextResponse.json({
      instrument_type,
      start_date: data.start_date,
      end_date: data.end_date,
      notional,
      smooth_curve: {
        npv: smoothNpv,
        dv01: smoothDv01,
        convexity: smoothDv01 * 0.01
      },
      composite_curve: {
        npv: compositeNpv,
        dv01: compositeDv01,
        convexity: compositeDv01 * 0.01
      },
      differences: {
        npv_diff: compositeNpv - smoothNpv,
        dv01_diff: compositeDv01 - smoothDv01,
        dv01_pct: ((compositeDv01 - smoothDv01) / smoothDv01 * 100)
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to calculate risk metrics' },
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