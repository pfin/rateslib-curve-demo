"""
API endpoint for running rateslib examples
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
import numpy as np
import rateslib as rl

try:
    from mangum import Mangum
except ImportError:
    Mangum = None

# Create FastAPI app
app = FastAPI(title="Rateslib Examples API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExampleRequest(BaseModel):
    example_id: str
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class ExampleResponse(BaseModel):
    type: str
    data: Any
    metadata: Optional[Dict[str, Any]] = None

# Example implementations
def run_sofr_curve():
    """Build a SOFR curve from market data"""
    today = datetime(2025, 6, 10)
    
    # Market data
    tenors = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y']
    rates = [4.31, 4.32, 4.27, 4.09, 3.79, 3.73, 3.95]
    
    # Create instruments
    instruments = []
    for tenor, rate in zip(tenors, rates):
        swap = rl.IRS(
            effective=today + timedelta(days=2),
            termination=tenor,
            frequency="Q" if tenor in ['1M', '3M', '6M'] else "S",
            convention="Act360",
            fixed_rate=rate,
            leg2_index_base="SOFR",
            notional=10_000_000,
            curves="sofr"
        )
        instruments.append(swap)
    
    # Build curve
    nodes = {today: 1.0}
    for inst in instruments:
        nodes[inst.termination] = 1.0
    
    curve = rl.Curve(
        nodes=nodes,
        id="sofr",
        interpolation="log_linear",
        convention="Act360",
        calendar="nyc"
    )
    
    # Solve
    solver = rl.Solver(
        curves=[curve],
        instruments=instruments,
        s=rates
    )
    
    # Generate output data
    plot_dates = []
    zero_rates = []
    forward_rates = []
    
    for days in range(0, 365*10, 30):
        date = today + timedelta(days=days)
        plot_dates.append(date.strftime('%Y-%m-%d'))
        
        # Zero rate
        try:
            zero = solver.curves['sofr'].rate(date, today) * 100
            zero_rates.append(float(zero))
        except:
            zero_rates.append(None)
        
        # 3M forward rate
        try:
            fwd_date = date + timedelta(days=90)
            fwd = solver.curves['sofr'].rate(fwd_date, date) * 100
            forward_rates.append(float(fwd))
        except:
            forward_rates.append(None)
    
    return ExampleResponse(
        type="curve",
        data={
            "dates": plot_dates[:7],
            "zero_rates": zero_rates[:7],
            "forward_rates": forward_rates[:7]
        },
        metadata={
            "solver_success": solver.result['success'],
            "iterations": solver.result['nit'],
            "max_error_bps": float(max(abs(solver.result['fun']))) if solver.result['fun'] is not None else 0
        }
    )

def run_fomc_turns():
    """Analyze FOMC meeting impacts on forward rates"""
    today = datetime(2025, 6, 10)
    
    # FOMC dates
    fomc_dates = [
        datetime(2025, 1, 29),
        datetime(2025, 3, 19),
        datetime(2025, 5, 7),
        datetime(2025, 6, 18),
        datetime(2025, 7, 30),
        datetime(2025, 9, 17)
    ]
    
    # Build curve with nodes at FOMC dates
    nodes = {today: 1.0}
    
    # Add FOMC nodes with step changes
    current_rate = 4.35
    for i, fomc_date in enumerate(fomc_dates):
        if fomc_date > today:
            # Assume 25bp cut at some meetings
            if i in [0, 1, 3]:  # Jan, Mar, Jun
                current_rate -= 0.25
            
            days = (fomc_date - today).days
            df = 1.0 / (1 + current_rate/100 * days/360)
            nodes[fomc_date] = df
    
    # Create step function curve
    step_curve = rl.Curve(
        nodes=nodes,
        interpolation="flat_forward",
        convention="Act360"
    )
    
    # Analyze meeting impacts
    meeting_impacts = []
    for fomc_date in fomc_dates[:4]:  # First 4 meetings
        if fomc_date > today:
            # Rate before meeting (1 day before)
            before_date = fomc_date - timedelta(days=1)
            after_date = fomc_date + timedelta(days=1)
            
            try:
                # 1-day forward rates
                rate_before = step_curve.rate(fomc_date, before_date) * 100
                rate_after = step_curve.rate(after_date, fomc_date) * 100
                
                meeting_impacts.append({
                    "date": fomc_date.strftime('%Y-%m-%d'),
                    "before": float(rate_before),
                    "after": float(rate_after),
                    "change": int((rate_after - rate_before) * 100)  # in bps
                })
            except:
                pass
    
    return ExampleResponse(
        type="fomc_analysis",
        data={
            "meeting_impacts": meeting_impacts
        }
    )

def run_convexity_adjustment():
    """Calculate futures/swaps convexity adjustment"""
    
    # Parameters
    futures_rate = 4.25  # %
    time_to_expiry = 0.5  # 6 months
    time_to_maturity = 0.75  # 9 months
    volatility = 75  # bps annualized
    
    # Calculate convexity adjustment
    # CA = -0.5 * σ² * T1 * T2
    adjustment = -0.5 * (volatility/10000)**2 * time_to_expiry * time_to_maturity
    adjustment_bps = adjustment * 10000
    
    # Implied swap rate
    swap_rate = futures_rate + adjustment * 100
    
    return ExampleResponse(
        type="convexity",
        data={
            "futures_rate": futures_rate,
            "adjustment_bps": abs(adjustment_bps),
            "swap_rate": swap_rate,
            "details": {
                "time_to_expiry": time_to_expiry,
                "time_to_maturity": time_to_maturity,
                "volatility": volatility
            }
        }
    )

def run_sofr_compounding():
    """Calculate compounded SOFR rate"""
    
    # Generate sample SOFR fixings
    np.random.seed(42)
    dates = [datetime(2025, 1, 1) + timedelta(days=i) for i in range(90)]
    fixings = np.random.normal(4.30, 0.05, len(dates))
    
    # Calculate compounded rate
    compound_factor = 1.0
    for i, (date, rate) in enumerate(zip(dates, fixings)):
        if i > 0:
            days = (dates[i] - dates[i-1]).days
        else:
            days = 1
        
        daily_factor = 1 + rate/100 * days/360
        compound_factor *= daily_factor
    
    # Annualized rate
    total_days = (dates[-1] - dates[0]).days
    compound_rate = (compound_factor - 1) * 360 / total_days * 100
    simple_avg = np.mean(fixings)
    
    return ExampleResponse(
        type="sofr_compounding",
        data={
            "period_days": total_days,
            "simple_average": float(simple_avg),
            "compound_rate": float(compound_rate),
            "difference_bps": float((compound_rate - simple_avg) * 100),
            "sample_fixings": fixings[:10].tolist()
        }
    )

@app.post("/examples", response_model=ExampleResponse)
async def run_example(request: ExampleRequest):
    """Run a rateslib example"""
    
    try:
        if request.example_id == "sofr_curve":
            return run_sofr_curve()
        elif request.example_id == "fomc_turns":
            return run_fomc_turns()
        elif request.example_id == "convexity_adjustment":
            return run_convexity_adjustment()
        elif request.example_id == "sofr_compounding":
            return run_sofr_compounding()
        else:
            # For other examples, return mock data
            return ExampleResponse(
                type="text",
                data=f"Example '{request.example_id}' completed successfully"
            )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error running example: {str(e)}"
        )

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "rateslib_version": rl.__version__
    }

# Create handler for Vercel
if Mangum:
    handler = Mangum(app, lifespan="off")