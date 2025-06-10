"""
Vercel serverless function for risk metrics calculation using rateslib
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime as dt, timedelta
import rateslib as rl

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST request for risk metrics"""
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Extract parameters
            instrument_type = data.get('instrument_type', 'swap')
            start_date = dt.fromisoformat(data.get('start_date'))
            end_date = dt.fromisoformat(data.get('end_date'))
            notional = data.get('notional', 10000000)
            
            # Build curves first (simplified - in production you'd pass curve state)
            curve_date = dt(2025, 6, 10)  # Today's date
            smooth_curve = build_smooth_curve(curve_date)
            composite_curve = build_composite_curve(curve_date)
            
            # Calculate risk metrics
            result = calculate_risk_metrics(
                instrument_type, start_date, end_date, notional,
                smooth_curve, composite_curve
            )
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Convert to JSON-serializable format
            response_data = {
                'instrument_type': result['instrument_type'],
                'start_date': result['start_date'],
                'end_date': result['end_date'],
                'notional': result['notional'],
                'smooth_curve': {
                    'npv': float(result['smooth_curve']['npv']),
                    'dv01': float(result['smooth_curve']['dv01']),
                    'convexity': float(result['smooth_curve']['convexity'])
                },
                'composite_curve': {
                    'npv': float(result['composite_curve']['npv']),
                    'dv01': float(result['composite_curve']['dv01']),
                    'convexity': float(result['composite_curve']['convexity'])
                },
                'differences': {
                    'npv_diff': float(result['differences']['npv_diff']),
                    'dv01_diff': float(result['differences']['dv01_diff']),
                    'dv01_pct': float(result['differences']['dv01_pct'])
                }
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

def build_smooth_curve(curve_date):
    """Build a simple smooth curve for risk calculations"""
    tenors = ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y']
    rates = [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
    
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
    
    return solver.curves["SMOOTH"]

def build_composite_curve(curve_date):
    """Build a composite curve with step function for short end"""
    # Simplified version - in production this would be more sophisticated
    
    # Long end
    long_tenors = ['2Y', '3Y', '5Y', '7Y', '10Y']
    long_rates = [3.70, 3.75, 3.85, 3.95, 4.05]
    
    long_instruments = []
    for tenor in long_tenors:
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="LONG"
        )
        long_instruments.append(irs)
    
    long_nodes = {curve_date: 1.0}
    for inst in long_instruments:
        long_nodes[inst.leg1.schedule.termination] = 1.0
    
    long_curve = rl.Curve(
        nodes=long_nodes,
        id="LONG",
        convention="Act360",
        calendar="nyc",
        interpolation="log_linear"
    )
    
    long_solver = rl.Solver(
        curves=[long_curve],
        instruments=long_instruments,
        s=long_rates
    )
    
    # Short end with FOMC dates
    short_nodes = {curve_date: 1.0}
    
    # Add upcoming FOMC dates from June 2025
    fomc_dates = [
        dt(2025, 6, 18),  # Next week
        dt(2025, 7, 30),
        dt(2025, 9, 17),
        dt(2025, 10, 29)
    ]
    
    for fomc in fomc_dates:
        if fomc > curve_date:
            short_nodes[fomc] = 1.0
    
    # Add short tenor dates
    short_tenors = ['1W', '2W', '1M', '2M', '3M', '6M', '9M', '1Y']
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
        id="SHORT",
        convention="Act360",
        calendar="nyc",
        interpolation="flat_forward"
    )
    
    # Create composite
    composite = rl.CompositeCurve(
        curves=[short_curve, long_solver.curves["LONG"]],
        id="COMPOSITE"
    )
    
    # Calibrate short end
    short_rates = [4.33, 4.33, 4.32, 4.28, 4.20, 4.05, 3.95, 3.85]
    short_instruments = []
    
    for i, tenor in enumerate(short_tenors):
        irs = rl.IRS(
            effective=curve_date + timedelta(days=2),
            termination=tenor,
            spec="usd_irs",
            curves="COMPOSITE"
        )
        short_instruments.append(irs)
    
    composite_solver = rl.Solver(
        curves=[composite],
        instruments=short_instruments,
        s=short_rates
    )
    
    return composite_solver.curves["COMPOSITE"]

def calculate_risk_metrics(instrument_type, start_date, end_date, notional, smooth_curve, composite_curve):
    """Calculate risk metrics for instruments spanning FOMC dates using rateslib"""
    
    if instrument_type == 'swap':
        # Create swap
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
        
        # Calculate NPV
        smooth_npv = swap_smooth.npv(curves={"SMOOTH": smooth_curve})
        composite_npv = swap_composite.npv(curves={"COMPOSITE": composite_curve})
        
        # Calculate DV01
        smooth_dv01 = swap_smooth.delta(curves={"SMOOTH": smooth_curve})
        composite_dv01 = swap_composite.delta(curves={"COMPOSITE": composite_curve})
        
        # Calculate convexity (gamma)
        smooth_gamma = swap_smooth.gamma(curves={"SMOOTH": smooth_curve})
        composite_gamma = swap_composite.gamma(curves={"COMPOSITE": composite_curve})
        
    elif instrument_type == 'fra':
        # Create FRA
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
        # Default to zero
        smooth_npv = 0
        composite_npv = 0
        smooth_dv01 = 0
        composite_dv01 = 0
        smooth_gamma = 0
        composite_gamma = 0
    
    # Handle Dual objects
    if hasattr(smooth_npv, 'real'):
        smooth_npv = smooth_npv.real
    if hasattr(composite_npv, 'real'):
        composite_npv = composite_npv.real
    if hasattr(smooth_dv01, 'real'):
        smooth_dv01 = smooth_dv01.real
    if hasattr(composite_dv01, 'real'):
        composite_dv01 = composite_dv01.real
    if hasattr(smooth_gamma, 'real'):
        smooth_gamma = smooth_gamma.real
    if hasattr(composite_gamma, 'real'):
        composite_gamma = composite_gamma.real
    
    # Sum gamma if it's a matrix
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
            'npv': smooth_npv,
            'dv01': smooth_dv01,
            'convexity': smooth_gamma
        },
        'composite_curve': {
            'npv': composite_npv,
            'dv01': composite_dv01,
            'convexity': composite_gamma
        },
        'differences': {
            'npv_diff': composite_npv - smooth_npv,
            'dv01_diff': composite_dv01 - smooth_dv01,
            'dv01_pct': ((composite_dv01 - smooth_dv01) / smooth_dv01 * 100) if smooth_dv01 != 0 else 0
        }
    }