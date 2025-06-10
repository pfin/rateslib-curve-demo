"""
Vercel serverless function for risk metrics calculation
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
            
            # Calculate risk metrics
            result = calculate_risk_metrics(instrument_type, start_date, end_date, notional)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def calculate_risk_metrics(instrument_type, start_date, end_date, notional):
    """Calculate risk metrics for instruments spanning FOMC dates"""
    
    # For demo purposes, return illustrative differences
    # In production, you'd use actual curves and instruments
    
    # Mock calculations showing typical differences
    if instrument_type == 'swap':
        # 3M swap spanning FOMC
        smooth_dv01 = -2450.50
        composite_dv01 = -2315.25
        
        smooth_npv = 12500.00
        composite_npv = 11875.00
        
    elif instrument_type == 'fra':
        # 1M FRA around FOMC
        smooth_dv01 = -833.33
        composite_dv01 = -825.00
        
        smooth_npv = -2100.00
        composite_npv = -2250.00
    
    else:
        smooth_dv01 = 0
        composite_dv01 = 0
        smooth_npv = 0
        composite_npv = 0
    
    return {
        'instrument_type': instrument_type,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'notional': notional,
        'smooth_curve': {
            'npv': smooth_npv,
            'dv01': smooth_dv01,
            'convexity': smooth_dv01 * 0.01  # Simplified
        },
        'composite_curve': {
            'npv': composite_npv,
            'dv01': composite_dv01,
            'convexity': composite_dv01 * 0.01
        },
        'differences': {
            'npv_diff': composite_npv - smooth_npv,
            'dv01_diff': composite_dv01 - smooth_dv01,
            'dv01_pct': ((composite_dv01 - smooth_dv01) / smooth_dv01 * 100)
        }
    }