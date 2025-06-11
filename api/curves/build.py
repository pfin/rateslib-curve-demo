"""
API endpoint for building curves with rateslib
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import rateslib as rl

try:
    from mangum import Mangum
except ImportError:
    Mangum = None

# Create FastAPI app
app = FastAPI(title="Curve Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MarketDataPoint(BaseModel):
    tenor: str
    rate: float

class CurveBuildRequest(BaseModel):
    curve_date: date
    interpolation: str = "log_linear"
    market_data: List[MarketDataPoint]
    convention: str = "Act360"
    calendar: str = "nyc"
    spot_lag: int = 2
    include_fomc: bool = False

class CurveBuildResponse(BaseModel):
    dates: List[str]
    zero_rates: List[float]
    discount_factors: List[float]
    forward_rates: List[float]
    calibration: Dict[str, Any]

# FOMC dates for 2025
FOMC_DATES = [
    datetime(2025, 1, 29),
    datetime(2025, 3, 19),
    datetime(2025, 5, 7),
    datetime(2025, 6, 18),
    datetime(2025, 7, 30),
    datetime(2025, 9, 17),
    datetime(2025, 10, 29),
    datetime(2025, 12, 10),
]

@app.post("/curves/build", response_model=CurveBuildResponse)
async def build_curve(request: CurveBuildRequest):
    """Build a curve using rateslib"""
    
    try:
        # Convert date
        curve_date = datetime.combine(request.curve_date, datetime.min.time())
        
        # Create instruments
        instruments = []
        rates = []
        
        for data_point in request.market_data:
            # Create IRS for each tenor
            effective = curve_date + timedelta(days=request.spot_lag)
            
            # Determine frequency based on tenor
            if data_point.tenor in ['1M', '2M', '3M', '4M', '5M', '6M']:
                frequency = "Q"
            else:
                frequency = "S"
            
            swap = rl.IRS(
                effective=effective,
                termination=data_point.tenor,
                frequency=frequency,
                convention=request.convention,
                fixed_rate=data_point.rate,
                leg2_index_base="SOFR",
                notional=10_000_000,
                curves="sofr",
                calendar=request.calendar
            )
            
            instruments.append(swap)
            rates.append(data_point.rate)
        
        # Build initial curve nodes
        nodes = {curve_date: 1.0}
        
        # Add termination dates as nodes
        for inst in instruments:
            nodes[inst.termination] = 1.0
        
        # Add FOMC dates if requested
        if request.include_fomc:
            for fomc_date in FOMC_DATES:
                if fomc_date > curve_date:
                    nodes[fomc_date] = 1.0
        
        # Create curve
        curve = rl.Curve(
            nodes=nodes,
            id="sofr",
            interpolation=request.interpolation,
            convention=request.convention,
            calendar=request.calendar
        )
        
        # Solve
        import time
        start_time = time.time()
        
        solver = rl.Solver(
            curves=[curve],
            instruments=instruments,
            s=rates
        )
        
        runtime_ms = int((time.time() - start_time) * 1000)
        
        # Generate output data
        dates = []
        zero_rates = []
        discount_factors = []
        forward_rates = []
        
        # Generate daily points for 2 years
        for days in range(0, 731, 7):  # Weekly points
            date_point = curve_date + timedelta(days=days)
            dates.append(date_point.strftime('%Y-%m-%d'))
            
            try:
                # Get zero rate
                zero = solver.curves['sofr'].rate(date_point, curve_date)
                zero_rates.append(float(zero) * 100)
                
                # Get discount factor
                df = solver.curves['sofr'].df(date_point, curve_date)
                discount_factors.append(float(df))
                
                # Get 1-day forward rate
                if days > 0:
                    next_date = date_point + timedelta(days=1)
                    fwd = solver.curves['sofr'].rate(next_date, date_point)
                    forward_rates.append(float(fwd) * 100)
                else:
                    forward_rates.append(float(zero) * 100)
                    
            except Exception as e:
                # Handle extrapolation errors
                zero_rates.append(zero_rates[-1] if zero_rates else 4.0)
                discount_factors.append(discount_factors[-1] if discount_factors else 1.0)
                forward_rates.append(forward_rates[-1] if forward_rates else 4.0)
        
        # Extract real values from Dual objects if needed
        def extract_real(value):
            if hasattr(value, 'real'):
                return float(value.real)
            return float(value)
        
        return CurveBuildResponse(
            dates=dates,
            zero_rates=[extract_real(r) for r in zero_rates],
            discount_factors=[extract_real(df) for df in discount_factors],
            forward_rates=[extract_real(r) for r in forward_rates],
            calibration={
                "success": solver.result['success'],
                "iterations": solver.result['nit'],
                "max_error": float(max(abs(solver.result['fun']))) if solver.result['fun'] is not None else 0.0,
                "runtime_ms": runtime_ms
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error building curve: {str(e)}"
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