"""
Vercel serverless function for curve building with rateslib
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime as dt, timedelta
import rateslib as rl

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST request for curve building"""
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Extract parameters
            curve_date_str = data.get('curve_date', '2025-01-15')
            curve_date = dt.fromisoformat(curve_date_str)
            market_data = data.get('market_data', {})
            fomc_dates_str = data.get('fomc_dates', [])
            fomc_dates = [dt.fromisoformat(d) for d in fomc_dates_str]
            
            # Build curves
            result = build_curves(curve_date, market_data, fomc_dates)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Convert result to JSON-serializable format
            response_data = {
                'smooth': {
                    'status': result['smooth']['status'],
                    'iterations': result['smooth']['iterations'],
                    'forwards': [float(f) if f is not None else None for f in result['smooth']['forwards']]
                },
                'composite': {
                    'status': result['composite']['status'],
                    'iterations': result['composite']['iterations'],
                    'forwards': [float(f) if f is not None else None for f in result['composite']['forwards']]
                },
                'dates': result['dates'],
                'fomc_dates': result['fomc_dates']
            }
            
            self.wfile.write(json.dumps(response_data).encode())
            
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

def build_curves(curve_date, market_data, fomc_dates):
    """Build both smooth and step function curves using rateslib"""
    
    # Default market data if not provided
    if not market_data or 'tenors' not in market_data:
        market_data = {
            'tenors': ['1W', '2W', '1M', '2M', '3M', '4M', '5M', '6M', '9M', '1Y', '18M', '2Y', '3Y', '5Y', '7Y', '10Y'],
            'rates': [5.32, 5.32, 5.31, 5.25, 5.15, 5.10, 5.05, 5.00, 4.85, 4.70, 4.50, 4.40, 4.35, 4.45, 4.55, 4.65]
        }
    
    tenors = market_data['tenors']
    rates = market_data['rates']
    
    # Build smooth curve
    smooth_curve_data = build_smooth_curve(curve_date, tenors, rates)
    
    # Build composite curve with step function
    composite_curve_data = build_composite_curve(curve_date, tenors, rates, fomc_dates)
    
    # Calculate forward rates for visualization
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
            # Handle Dual objects
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
            # Handle Dual objects
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

def build_smooth_curve(curve_date, tenors, rates):
    """Build standard smooth curve with log-linear interpolation using rateslib"""
    
    # Create instruments
    instruments = []
    for tenor in tenors:
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="SMOOTH"
        )
        instruments.append(irs)
    
    # Build curve nodes
    nodes = {curve_date: 1.0}
    for inst in instruments:
        nodes[inst.leg1.schedule.termination] = 1.0
    
    # Create curve
    curve = rl.Curve(
        nodes=nodes,
        id="SMOOTH",
        convention="Act360",
        calendar="nyc",
        interpolation="log_linear"
    )
    
    # Calibrate
    solver = rl.Solver(
        curves=[curve],
        instruments=instruments,
        s=rates,
        id="Smooth_Calibration"
    )
    
    return {
        'curve': solver.curves["SMOOTH"],
        'status': solver.result['status'],
        'iterations': solver.result['iterations']
    }

def build_composite_curve(curve_date, tenors, rates, fomc_dates):
    """Build composite curve with step function for short end using rateslib"""
    
    # Split tenors into short and long
    short_tenors = []
    short_rates = []
    long_tenors = []
    long_rates = []
    
    for i, tenor in enumerate(tenors):
        if tenor in ['18M', '2Y', '3Y', '5Y', '7Y', '10Y']:
            long_tenors.append(tenor)
            long_rates.append(rates[i])
        else:
            short_tenors.append(tenor)
            short_rates.append(rates[i])
    
    # Build long-end curve first
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
    
    # Build short-end curve with FOMC nodes
    short_nodes = {curve_date: 1.0}
    
    # Add FOMC dates as nodes
    for fomc_date in fomc_dates:
        if fomc_date > curve_date and fomc_date < curve_date + timedelta(days=540):  # 18 months
            short_nodes[fomc_date] = 1.0
    
    # Add standard tenor points
    for tenor in short_tenors:
        date = rl.add_tenor(
            start=curve_date + timedelta(days=2),
            tenor=tenor,
            modifier="mf",
            calendar="nyc"
        )
        short_nodes[date] = 1.0
    
    # Create short curve with flat forward interpolation
    short_curve = rl.Curve(
        nodes=short_nodes,
        id="SHORT_END",
        convention="Act360",
        calendar="nyc",
        interpolation="flat_forward"  # Step function
    )
    
    # Create composite curve
    composite_curve = rl.CompositeCurve(
        curves=[short_curve, long_solver.curves["LONG_END"]],
        id="COMPOSITE"
    )
    
    # Create instruments for calibration
    instruments = []
    calib_rates = []
    
    # Add turn instruments if FOMC dates provided
    if len(fomc_dates) > 1:
        # First FOMC - no change
        fra1 = rl.FRA(
            effective=fomc_dates[0] - timedelta(days=1),
            termination=fomc_dates[0] + timedelta(days=1),
            fixed_rate=5.33,
            curves="COMPOSITE"
        )
        instruments.append(fra1)
        calib_rates.append(5.33)
        
        # Second FOMC - 25bps cut
        if len(fomc_dates) > 1:
            fra2 = rl.FRA(
                effective=fomc_dates[1] - timedelta(days=1),
                termination=fomc_dates[1] + timedelta(days=1),
                fixed_rate=5.08,
                curves="COMPOSITE"
            )
            instruments.append(fra2)
            calib_rates.append(5.08)
    
    # Add regular short-end instruments
    for i, tenor in enumerate(short_tenors):
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="COMPOSITE"
        )
        instruments.append(irs)
        calib_rates.append(short_rates[i])
    
    # Solve
    solver = rl.Solver(
        curves=[composite_curve],
        instruments=instruments,
        s=calib_rates
    )
    
    return {
        'curve': solver.curves["COMPOSITE"],
        'status': solver.result['status'],
        'iterations': solver.result['iterations']
    }