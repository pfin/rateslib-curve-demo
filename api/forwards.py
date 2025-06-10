"""
Vercel serverless function for forward rate calculations
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime as dt, timedelta
import rateslib as rl

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST request for forward rate analysis"""
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Extract parameters
            fomc_date = dt.fromisoformat(data.get('fomc_date'))
            smooth_curve_data = data.get('smooth_curve')
            composite_curve_data = data.get('composite_curve')
            
            # Rebuild curves from data (simplified for demo)
            # In production, you'd pass curve state or use caching
            
            # Calculate forward rates around FOMC
            result = analyze_fomc_forwards(fomc_date)
            
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

def analyze_fomc_forwards(fomc_date):
    """Analyze forward rates around FOMC date"""
    
    # For demo purposes, return mock data
    # In production, you'd use the actual curves
    
    days_range = range(-7, 8)  # 1 week before to 1 week after
    dates = []
    smooth_forwards = []
    composite_forwards = []
    
    for day_offset in days_range:
        date = fomc_date + timedelta(days=day_offset)
        dates.append(date.isoformat())
        
        # Mock data showing step function behavior
        if day_offset < 0:
            smooth_forwards.append(5.33)
            composite_forwards.append(5.33)
        else:
            # Smooth curve averages the jump
            smooth_forwards.append(5.20)
            # Composite shows sharp jump
            composite_forwards.append(5.08)
    
    return {
        'dates': dates,
        'smooth_forwards': smooth_forwards,
        'composite_forwards': composite_forwards,
        'fomc_date': fomc_date.isoformat()
    }