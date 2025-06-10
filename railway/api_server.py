"""
FastAPI server for rateslib calculations
Deploy this to Railway, Render, or any platform that supports Docker
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import rateslib as rl
from datetime import datetime as dt, timedelta
import uvicorn

app = FastAPI(title="Rateslib Curve API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MarketData(BaseModel):
    tenors: List[str]
    rates: List[float]


class CurveRequest(BaseModel):
    curve_date: str
    market_data: MarketData
    fomc_dates: List[str]


class RiskRequest(BaseModel):
    instrument_type: str
    start_date: str
    end_date: str
    notional: float = 10000000


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "rateslib_version": rl.__version__}


@app.post("/api/curves")
async def build_curves(request: CurveRequest):
    """Build smooth and composite curves"""
    try:
        curve_date = dt.fromisoformat(request.curve_date)
        fomc_dates = [dt.fromisoformat(d) for d in request.fomc_dates]
        
        result = build_curves_impl(
            curve_date,
            request.market_data.dict(),
            fomc_dates
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/risk")
async def calculate_risk(request: RiskRequest):
    """Calculate risk metrics"""
    try:
        start_date = dt.fromisoformat(request.start_date)
        end_date = dt.fromisoformat(request.end_date)
        
        # Build curves (simplified - in production, cache these)
        curve_date = dt(2025, 6, 10)
        smooth_curve = build_smooth_curve(curve_date)
        composite_curve = build_composite_curve(curve_date)
        
        result = calculate_risk_metrics(
            request.instrument_type,
            start_date,
            end_date,
            request.notional,
            smooth_curve,
            composite_curve
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def build_curves_impl(curve_date, market_data, fomc_dates):
    """Implementation matching the original curves.py"""
    tenors = market_data['tenors']
    rates = market_data['rates']
    
    # Build smooth curve
    smooth_curve_data = build_smooth_curve_full(curve_date, tenors, rates)
    
    # Build composite curve
    composite_curve_data = build_composite_curve_full(curve_date, tenors, rates, fomc_dates)
    
    # Calculate forward rates
    forward_dates = []
    smooth_forwards = []
    composite_forwards = []
    
    for i in range(180):  # 6 months of daily forwards
        date = curve_date + timedelta(days=i)
        forward_dates.append(date.isoformat())
        
        # Calculate 1-day forward rates
        try:
            smooth_fwd = smooth_curve_data['curve'].rate(
                effective=date,
                termination=date + timedelta(days=1)
            )
            if hasattr(smooth_fwd, 'real'):
                smooth_fwd = smooth_fwd.real
            smooth_forwards.append(float(smooth_fwd) * 100)
        except:
            smooth_forwards.append(None)
        
        try:
            composite_fwd = composite_curve_data['curve'].rate(
                effective=date,
                termination=date + timedelta(days=1)
            )
            if hasattr(composite_fwd, 'real'):
                composite_fwd = composite_fwd.real
            composite_forwards.append(float(composite_fwd) * 100)
        except:
            composite_forwards.append(None)
    
    return {
        'smooth': {
            'status': smooth_curve_data['status'],
            'iterations': smooth_curve_data['iterations'],
            'forwards': smooth_forwards
        },
        'composite': {
            'status': composite_curve_data['status'],
            'iterations': composite_curve_data['iterations'],
            'forwards': composite_forwards
        },
        'dates': forward_dates,
        'fomc_dates': [d.isoformat() for d in fomc_dates]
    }


def build_smooth_curve_full(curve_date, tenors, rates):
    """Build smooth curve with log-linear interpolation"""
    instruments = []
    for tenor in tenors:
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="SMOOTH"
        )
        instruments.append(irs)
    
    nodes = {curve_date: 1.0}
    for inst in instruments:
        nodes[inst.leg1.schedule.termination] = 1.0
    
    curve = rl.Curve(
        nodes=nodes,
        id="SMOOTH",
        convention="Act360",
        calendar="nyc",
        interpolation="log_linear"
    )
    
    solver = rl.Solver(
        curves=[curve],
        instruments=instruments,
        s=rates
    )
    
    return {
        'curve': solver.curves["SMOOTH"],
        'status': solver.result['status'],
        'iterations': solver.result['iterations']
    }


def build_composite_curve_full(curve_date, tenors, rates, fomc_dates):
    """Build composite curve with step function for short end"""
    # Split tenors
    short_tenors = []
    short_rates = []
    long_tenors = []
    long_rates = []
    
    for i, tenor in enumerate(tenors):
        if tenor in ['18M', '2Y', '3Y', '4Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y']:
            long_tenors.append(tenor)
            long_rates.append(rates[i])
        else:
            short_tenors.append(tenor)
            short_rates.append(rates[i])
    
    # Build long end
    long_instruments = []
    for tenor in long_tenors:
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="LONG_END"
        )
        long_instruments.append(irs)
    
    long_nodes = {curve_date: 1.0}
    for inst in long_instruments:
        long_nodes[inst.leg1.schedule.termination] = 1.0
    
    long_curve = rl.Curve(
        nodes=long_nodes,
        id="LONG_END",
        convention="Act360",
        calendar="nyc",
        interpolation="log_linear"
    )
    
    long_solver = rl.Solver(
        curves=[long_curve],
        instruments=long_instruments,
        s=long_rates
    )
    
    # Build short end with FOMC nodes
    short_nodes = {curve_date: 1.0}
    
    for fomc_date in fomc_dates:
        if fomc_date > curve_date and fomc_date < curve_date + timedelta(days=540):
            short_nodes[fomc_date] = 1.0
    
    for tenor in short_tenors:
        date = rl.add_tenor(
            start=curve_date + timedelta(days=2),
            tenor=tenor,
            modifier="mf",
            calendar="nyc"
        )
        short_nodes[date] = 1.0
    
    short_curve = rl.Curve(
        nodes=short_nodes,
        id="SHORT_END",
        convention="Act360",
        calendar="nyc",
        interpolation="flat_forward"
    )
    
    # Create composite
    composite = rl.CompositeCurve(
        curves=[short_curve, long_solver.curves["LONG_END"]],
        id="COMPOSITE"
    )
    
    # Calibrate
    instruments = []
    calib_rates = []
    
    # Add turn instruments for FOMC dates
    if len(fomc_dates) > 0:
        # Next FOMC - no change expected
        fra1 = rl.FRA(
            effective=fomc_dates[0] - timedelta(days=1),
            termination=fomc_dates[0] + timedelta(days=1),
            fixed_rate=4.29,  # Current SOFR
            curves="COMPOSITE"
        )
        instruments.append(fra1)
        calib_rates.append(4.29)
    
    # Add regular instruments
    for i, tenor in enumerate(short_tenors):
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="COMPOSITE"
        )
        instruments.append(irs)
        calib_rates.append(short_rates[i])
    
    solver = rl.Solver(
        curves=[composite],
        instruments=instruments,
        s=calib_rates
    )
    
    return {
        'curve': solver.curves["COMPOSITE"],
        'status': solver.result['status'],
        'iterations': solver.result['iterations']
    }


def build_smooth_curve(curve_date):
    """Simple smooth curve for risk calculations"""
    tenors = ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y']
    rates = [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
    data = build_smooth_curve_full(curve_date, tenors, rates)
    return data['curve']


def build_composite_curve(curve_date):
    """Simple composite curve for risk calculations"""
    tenors = ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y']
    rates = [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
    fomc_dates = [
        dt(2025, 6, 18),
        dt(2025, 7, 30),
        dt(2025, 9, 17),
        dt(2025, 10, 29)
    ]
    data = build_composite_curve_full(curve_date, tenors, rates, fomc_dates)
    return data['curve']


def calculate_risk_metrics(instrument_type, start_date, end_date, notional, smooth_curve, composite_curve):
    """Calculate risk metrics for instruments"""
    if instrument_type == 'swap':
        # Create swaps
        swap_smooth = rl.IRS(
            effective=start_date,
            termination=end_date,
            spec="usd_irs",
            fixed_rate=4.15,
            notional=notional,
            curves="SMOOTH"
        )
        
        swap_composite = rl.IRS(
            effective=start_date,
            termination=end_date,
            spec="usd_irs",
            fixed_rate=4.15,
            notional=notional,
            curves="COMPOSITE"
        )
        
        # Calculate metrics
        smooth_npv = swap_smooth.npv(curves={"SMOOTH": smooth_curve})
        composite_npv = swap_composite.npv(curves={"COMPOSITE": composite_curve})
        
        smooth_dv01 = swap_smooth.delta(curves={"SMOOTH": smooth_curve})
        composite_dv01 = swap_composite.delta(curves={"COMPOSITE": composite_curve})
        
        smooth_gamma = swap_smooth.gamma(curves={"SMOOTH": smooth_curve})
        composite_gamma = swap_composite.gamma(curves={"COMPOSITE": composite_curve})
        
    elif instrument_type == 'fra':
        # Create FRAs
        fra_smooth = rl.FRA(
            effective=start_date,
            termination="3M",
            fixed_rate=4.20,
            notional=notional,
            curves="SMOOTH"
        )
        
        fra_composite = rl.FRA(
            effective=start_date,
            termination="3M",
            fixed_rate=4.20,
            notional=notional,
            curves="COMPOSITE"
        )
        
        # Calculate metrics
        smooth_npv = fra_smooth.npv(curves={"SMOOTH": smooth_curve})
        composite_npv = fra_composite.npv(curves={"COMPOSITE": composite_curve})
        
        smooth_dv01 = fra_smooth.delta(curves={"SMOOTH": smooth_curve})
        composite_dv01 = fra_composite.delta(curves={"COMPOSITE": composite_curve})
        
        smooth_gamma = fra_smooth.gamma(curves={"SMOOTH": smooth_curve})
        composite_gamma = fra_composite.gamma(curves={"COMPOSITE": composite_curve})
    
    else:
        raise ValueError(f"Unknown instrument type: {instrument_type}")
    
    # Handle Dual objects
    for var in [smooth_npv, composite_npv, smooth_dv01, composite_dv01, smooth_gamma, composite_gamma]:
        if hasattr(var, 'real'):
            var = var.real
    
    # Handle gamma matrices
    if hasattr(smooth_gamma, 'sum'):
        smooth_gamma = smooth_gamma.sum().sum()
    if hasattr(composite_gamma, 'sum'):
        composite_gamma = composite_gamma.sum().sum()
    
    return {
        'instrument_type': instrument_type,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'notional': notional,
        'smooth_curve': {
            'npv': float(smooth_npv),
            'dv01': float(smooth_dv01),
            'convexity': float(smooth_gamma)
        },
        'composite_curve': {
            'npv': float(composite_npv),
            'dv01': float(composite_dv01),
            'convexity': float(composite_gamma)
        },
        'differences': {
            'npv_diff': float(composite_npv - smooth_npv),
            'dv01_diff': float(composite_dv01 - smooth_dv01),
            'dv01_pct': float((composite_dv01 - smooth_dv01) / smooth_dv01 * 100) if smooth_dv01 != 0 else 0
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)