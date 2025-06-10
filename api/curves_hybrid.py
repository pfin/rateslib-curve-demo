"""
Hybrid curve building - uses rateslib if available, fallback to simplified calculation
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime as dt, timedelta
import math

# Try to import rateslib
try:
    import rateslib as rl
    RATESLIB_AVAILABLE = True
except ImportError:
    RATESLIB_AVAILABLE = False
    print("Warning: rateslib not available, using simplified calculations")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST request for curve building"""
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Extract parameters
            curve_date_str = data.get('curve_date', '2025-06-10')
            curve_date = dt.fromisoformat(curve_date_str)
            market_data = data.get('market_data', {})
            fomc_dates_str = data.get('fomc_dates', [])
            fomc_dates = [dt.fromisoformat(d) for d in fomc_dates_str]
            
            # Build curves
            if RATESLIB_AVAILABLE:
                result = build_curves_rateslib(curve_date, market_data, fomc_dates)
            else:
                result = build_curves_simple(curve_date, market_data, fomc_dates)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e), 'type': type(e).__name__}).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def build_curves_rateslib(curve_date, market_data, fomc_dates):
    """Build curves using rateslib"""
    # Default market data if not provided
    if not market_data or 'tenors' not in market_data:
        # Use default market data
        market_data = {
            'tenors': ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y'],
            'rates': [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
        }
    
    tenors = market_data['tenors']
    rates = market_data['rates']
    
    # Build smooth curve
    smooth_curve_data = build_smooth_curve_rl(curve_date, tenors, rates)
    
    # Build composite curve
    composite_curve_data = build_composite_curve_rl(curve_date, tenors, rates, fomc_dates)
    
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
        'fomc_dates': [d.isoformat() for d in fomc_dates],
        'method': 'rateslib'
    }


def build_smooth_curve_rl(curve_date, tenors, rates):
    """Build smooth curve with rateslib"""
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


def build_composite_curve_rl(curve_date, tenors, rates, fomc_dates):
    """Build composite curve with rateslib"""
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
    
    # Build long end first
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
    
    # Add turn instruments for next FOMC
    if len(fomc_dates) > 0 and fomc_dates[0] > curve_date:
        fra1 = rl.FRA(
            effective=fomc_dates[0] - timedelta(days=1),
            termination=fomc_dates[0] + timedelta(days=1),
            fixed_rate=4.29,
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


def build_curves_simple(curve_date, market_data, fomc_dates):
    """Simplified curve building without rateslib"""
    
    # Default market data if not provided
    if not market_data or 'tenors' not in market_data:
        # Use default market data
        market_data = {
            'tenors': ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y'],
            'rates': [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
        }
    
    tenors = market_data['tenors']
    rates = market_data['rates']
    
    # Calculate forward rates
    forward_dates = []
    smooth_forwards = []
    composite_forwards = []
    
    # Convert tenors to days
    tenor_days = []
    for tenor in tenors:
        if tenor.endswith('M'):
            months = int(tenor[:-1])
            days = months * 30
        elif tenor.endswith('Y'):
            years = int(tenor[:-1])
            days = years * 365
        else:
            days = 30  # default
        tenor_days.append(days)
    
    # Simple interpolation for forward rates
    for i in range(180):  # 6 months of daily forwards
        date = curve_date + timedelta(days=i)
        forward_dates.append(date.isoformat())
        
        # Find surrounding tenors
        days_from_start = i
        
        # Linear interpolation
        smooth_fwd = interpolate_rate(days_from_start, tenor_days, rates)
        smooth_forwards.append(smooth_fwd)
        
        # Step function for composite
        # Check if we're near a FOMC date
        near_fomc = False
        for fomc in fomc_dates:
            if abs((date - fomc).days) < 2:
                near_fomc = True
                break
        
        if near_fomc and i < 180:  # Short end
            # Use flat forward around FOMC
            composite_fwd = smooth_fwd
            if i > 0:
                composite_fwd = composite_forwards[-1]  # Keep previous rate
        else:
            composite_fwd = smooth_fwd
        
        composite_forwards.append(composite_fwd)
    
    return {
        'smooth': {
            'status': 'Success',
            'iterations': 1,
            'forwards': smooth_forwards
        },
        'composite': {
            'status': 'Success',
            'iterations': 1,
            'forwards': composite_forwards
        },
        'dates': forward_dates,
        'fomc_dates': [d.isoformat() for d in fomc_dates],
        'method': 'simplified' if not RATESLIB_AVAILABLE else 'rateslib'
    }


def interpolate_rate(target_days, tenor_days, rates):
    """Simple linear interpolation"""
    # Find surrounding points
    for i in range(len(tenor_days) - 1):
        if tenor_days[i] <= target_days <= tenor_days[i + 1]:
            # Linear interpolation
            t = (target_days - tenor_days[i]) / (tenor_days[i + 1] - tenor_days[i])
            return rates[i] * (1 - t) + rates[i + 1] * t
    
    # Extrapolate if outside range
    if target_days < tenor_days[0]:
        return rates[0]
    else:
        return rates[-1]