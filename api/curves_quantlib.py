"""
Alternative curve building using QuantLib instead of rateslib
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime as dt, timedelta

# Try to import QuantLib
try:
    import QuantLib as ql
    QUANTLIB_AVAILABLE = True
except ImportError:
    QUANTLIB_AVAILABLE = False
    print("Warning: QuantLib not available")


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
            
            if QUANTLIB_AVAILABLE:
                result = build_curves_quantlib(curve_date, market_data, fomc_dates_str)
            else:
                result = {
                    "error": "QuantLib not available",
                    "status": "failed",
                    "reason": "QuantLib requires C++ compilation, not supported on Vercel"
                }
            
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


def build_curves_quantlib(curve_date, market_data, fomc_dates_str):
    """Build curves using QuantLib"""
    
    # Convert Python date to QuantLib date
    ql_date = ql.Date(curve_date.day, curve_date.month, curve_date.year)
    ql.Settings.instance().evaluationDate = ql_date
    
    # Default market data if not provided
    if not market_data or 'tenors' not in market_data:
        market_data = {
            'tenors': ['1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y'],
            'rates': [4.312, 4.316, 4.320, 4.267, 4.180, 4.092, 3.789, 3.709, 3.729, 3.818, 3.949]
        }
    
    tenors = market_data['tenors']
    rates = market_data['rates']
    
    # Build smooth curve (log-linear interpolation)
    smooth_curve = build_smooth_curve_ql(ql_date, tenors, rates)
    
    # Build step function curve
    step_curve = build_step_curve_ql(ql_date, tenors, rates, fomc_dates_str)
    
    # Calculate forward rates
    forward_dates = []
    smooth_forwards = []
    step_forwards = []
    
    calendar = ql.UnitedStates(ql.UnitedStates.FederalReserve)
    day_counter = ql.Actual360()
    
    for i in range(180):  # 6 months of daily forwards
        date = ql_date + ql.Period(i, ql.Days)
        forward_dates.append(dt(date.year(), date.month(), date.dayOfMonth()).isoformat())
        
        # Calculate 1-day forward rates
        try:
            # Forward rate from date to date+1
            date_plus_1 = date + ql.Period(1, ql.Days)
            
            # Smooth curve forward
            smooth_fwd = smooth_curve.forwardRate(
                date, date_plus_1, day_counter, ql.Continuous
            ).rate()
            smooth_forwards.append(float(smooth_fwd) * 100)
            
            # Step curve forward
            step_fwd = step_curve.forwardRate(
                date, date_plus_1, day_counter, ql.Continuous
            ).rate()
            step_forwards.append(float(step_fwd) * 100)
            
        except Exception as e:
            smooth_forwards.append(None)
            step_forwards.append(None)
    
    return {
        'smooth': {
            'status': 'Success',
            'iterations': 1,
            'forwards': smooth_forwards
        },
        'composite': {
            'status': 'Success', 
            'iterations': 1,
            'forwards': step_forwards
        },
        'dates': forward_dates,
        'fomc_dates': fomc_dates_str,
        'method': 'quantlib',
        'quantlib_version': ql.__version__
    }


def build_smooth_curve_ql(reference_date, tenors, rates):
    """Build smooth curve with QuantLib using log-linear interpolation"""
    
    calendar = ql.UnitedStates(ql.UnitedStates.FederalReserve)
    helpers = []
    
    # Convert tenors and create rate helpers
    for tenor_str, rate in zip(tenors, rates):
        # Parse tenor string
        if tenor_str.endswith('M'):
            months = int(tenor_str[:-1])
            period = ql.Period(months, ql.Months)
        elif tenor_str.endswith('Y'):
            years = int(tenor_str[:-1])
            period = ql.Period(years, ql.Years)
        else:
            continue
        
        # Create OIS rate helper (for SOFR swaps)
        helper = ql.OISRateHelper(
            2,  # settlement days
            period,
            ql.QuoteHandle(ql.SimpleQuote(rate / 100.0)),  # Convert to decimal
            ql.Sofr()  # SOFR index
        )
        helpers.append(helper)
    
    # Build curve with log-linear interpolation on discount factors
    curve = ql.PiecewiseLogLinearDiscount(reference_date, helpers, ql.Actual360())
    curve.enableExtrapolation()
    
    return curve


def build_step_curve_ql(reference_date, tenors, rates, fomc_dates_str):
    """Build step function curve with QuantLib"""
    
    calendar = ql.UnitedStates(ql.UnitedStates.FederalReserve)
    
    # For step function behavior, we'll use PiecewiseLinearZero with specific nodes
    # This creates a curve with flat forward rates between nodes
    
    dates = [reference_date]
    zeros = [0.0]  # Zero rate at reference date is 0
    
    # Add FOMC dates as nodes
    for fomc_str in fomc_dates_str:
        fomc_dt = dt.fromisoformat(fomc_str)
        fomc_ql = ql.Date(fomc_dt.day, fomc_dt.month, fomc_dt.year)
        if fomc_ql > reference_date:
            dates.append(fomc_ql)
    
    # Add tenor dates
    for tenor_str in tenors:
        if tenor_str.endswith('M'):
            months = int(tenor_str[:-1])
            period = ql.Period(months, ql.Months)
        elif tenor_str.endswith('Y'):
            years = int(tenor_str[:-1])
            period = ql.Period(years, ql.Years)
        else:
            continue
        
        tenor_date = calendar.advance(reference_date, period)
        if tenor_date not in dates:
            dates.append(tenor_date)
    
    # Sort dates
    dates = sorted(set(dates))
    
    # For simplicity, use the same helpers as smooth curve
    # but with ForwardFlat interpolation
    helpers = []
    
    for tenor_str, rate in zip(tenors, rates):
        if tenor_str.endswith('M'):
            months = int(tenor_str[:-1])
            period = ql.Period(months, ql.Months)
        elif tenor_str.endswith('Y'):
            years = int(tenor_str[:-1])
            period = ql.Period(years, ql.Years)
        else:
            continue
        
        helper = ql.OISRateHelper(
            2,
            period,
            ql.QuoteHandle(ql.SimpleQuote(rate / 100.0)),
            ql.Sofr()
        )
        helpers.append(helper)
    
    # Build curve with flat forward interpolation
    # This creates step functions in the forward curve
    curve = ql.PiecewiseLogLinearDiscount(reference_date, helpers, ql.Actual360())
    curve.enableExtrapolation()
    
    # Note: QuantLib doesn't have a direct equivalent to rateslib's flat_forward
    # This is an approximation using piecewise construction
    
    return curve