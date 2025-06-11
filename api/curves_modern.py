"""
Modern Python API endpoint using FastAPI with Vercel
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime, date, timedelta
import rateslib as rl

try:
    from mangum import Mangum
except ImportError:
    # Mangum is only needed for Vercel deployment
    Mangum = None

# Create FastAPI app
app = FastAPI(
    title="Rateslib Curve API",
    version="2.0.0",
    description="Modern curve building API with rateslib"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for type safety
class MarketData(BaseModel):
    spot_rate: float = Field(4.29, description="SOFR spot rate")
    fomc_rates: Dict[str, float] = Field(
        default_factory=lambda: {
            "2025-06-18": 4.29,
            "2025-07-30": 4.25,
            "2025-09-17": 4.20,
            "2025-11-05": 4.15,
            "2025-12-17": 4.10,
        }
    )
    term_rates: Dict[str, float] = Field(
        default_factory=lambda: {
            "1Y": 4.05,
            "2Y": 3.95,
            "3Y": 3.71,
        }
    )

class CurveRequest(BaseModel):
    curve_date: date = Field(default_factory=lambda: date(2025, 6, 10))
    market_data: MarketData = Field(default_factory=MarketData)
    interpolation: Literal["flat_forward", "log_linear"] = "flat_forward"
    forward_tenor_days: int = Field(7, ge=1, le=30, description="Forward rate tenor in days")

class CurvePoint(BaseModel):
    date: date
    forward_rate: float
    zero_rate: Optional[float] = None

class CurveResponse(BaseModel):
    status: str = "success"
    curve_date: date
    interpolation: str
    points: List[CurvePoint]
    metadata: Dict[str, any] = Field(default_factory=dict)

class ErrorResponse(BaseModel):
    status: str = "error"
    error: str
    type: str
    timestamp: datetime = Field(default_factory=datetime.now)

# Cache for curve calculations (simple in-memory cache)
from functools import lru_cache
import hashlib
import json

def cache_key(request: CurveRequest) -> str:
    """Generate cache key from request parameters"""
    key_data = {
        "date": request.curve_date.isoformat(),
        "market": request.market_data.dict(),
        "interp": request.interpolation,
        "tenor": request.forward_tenor_days
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.md5(key_str.encode()).hexdigest()

@lru_cache(maxsize=100)
def build_curve_cached(cache_key: str, request_json: str) -> CurveResponse:
    """Cached curve building function"""
    request = CurveRequest.parse_raw(request_json)
    return build_curve_internal(request)

def build_curve_internal(request: CurveRequest) -> CurveResponse:
    """Internal curve building logic"""
    # Build nodes from market data
    nodes = {request.curve_date: 1.0}
    
    # Add FOMC meeting dates
    for date_str, rate in request.market_data.fomc_rates.items():
        fomc_date = datetime.fromisoformat(date_str).date()
        if fomc_date > request.curve_date:
            days = (fomc_date - request.curve_date).days
            nodes[fomc_date] = 1.0 / (1 + rate/100 * days/360)
    
    # Add term points
    term_map = {"1Y": 365, "2Y": 730, "3Y": 1095}
    for term, rate in request.market_data.term_rates.items():
        if term in term_map:
            term_date = request.curve_date + timedelta(days=term_map[term])
            nodes[term_date] = 1.0 / (1 + rate/100 * term_map[term]/360)
    
    # Build curve with rateslib
    curve = rl.Curve(
        nodes=nodes,
        interpolation=request.interpolation,
        convention="act_360",
        calendar="fed"
    )
    
    # Generate forward rates
    points = []
    for days in range(0, 365, 7):
        point_date = request.curve_date + timedelta(days=days)
        future_date = point_date + timedelta(days=request.forward_tenor_days)
        
        try:
            forward_rate = float(curve.rate(point_date, future_date)) * 100
            zero_rate = float(curve.rate(request.curve_date, point_date)) * 100 if days > 0 else None
            
            points.append(CurvePoint(
                date=point_date,
                forward_rate=forward_rate,
                zero_rate=zero_rate
            ))
        except Exception as e:
            # Skip points that can't be calculated
            continue
    
    return CurveResponse(
        curve_date=request.curve_date,
        interpolation=request.interpolation,
        points=points,
        metadata={
            "rateslib_version": rl.__version__,
            "nodes_count": len(nodes),
            "points_generated": len(points)
        }
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rateslib_version": rl.__version__,
        "api_version": "2.0.0"
    }

@app.post("/curves", response_model=CurveResponse)
async def build_curves(request: CurveRequest):
    """Build curves with given parameters"""
    try:
        # Use cache
        key = cache_key(request)
        result = build_curve_cached(key, request.json())
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error=str(e),
                type=type(e).__name__
            ).dict()
        )

@app.get("/curves", response_model=CurveResponse)
async def build_curves_get(
    curve_date: date = Query(default=date(2025, 6, 10)),
    interpolation: Literal["flat_forward", "log_linear"] = Query(default="flat_forward"),
    forward_tenor_days: int = Query(default=7, ge=1, le=30)
):
    """Build curves with query parameters"""
    request = CurveRequest(
        curve_date=curve_date,
        interpolation=interpolation,
        forward_tenor_days=forward_tenor_days
    )
    return await build_curves(request)

@app.get("/fomc-dates")
async def get_fomc_dates():
    """Get FOMC meeting dates"""
    return {
        "2025": [
            "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
            "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10"
        ],
        "2026": [
            "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
            "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09"
        ]
    }

# Exception handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error=str(exc),
            type="validation_error"
        ).dict()
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=str(exc),
            type=type(exc).__name__
        ).dict()
    )

# Create handler for Vercel
handler = Mangum(app, lifespan="off")