"""
Rateslib-only curve building API endpoint
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET request for curve data"""
        result = {"status": "starting"}
        
        try:
            # Import rateslib
            import rateslib as rl
            result["rateslib_version"] = rl.__version__
            
            # Parse query parameters
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            # Get curve date from query params
            curve_date_str = query_params.get('curve_date', ['2025-06-10'])[0]
            curve_date = datetime.fromisoformat(curve_date_str)
            
            # Market data from June 10, 2025
            spot_rate = 4.29  # SOFR spot rate
            
            # Build a simple curve with FOMC dates
            nodes = {
                curve_date: 1.0,
                datetime(2025, 6, 18): 1.0 / (1 + spot_rate/100 * 8/360),  # June FOMC
                datetime(2025, 7, 30): 1.0 / (1 + 4.25/100 * 50/360),     # July FOMC  
                datetime(2025, 9, 17): 1.0 / (1 + 4.20/100 * 99/360),     # Sept FOMC
                datetime(2025, 11, 5): 1.0 / (1 + 4.15/100 * 148/360),    # Nov FOMC
                datetime(2025, 12, 17): 1.0 / (1 + 4.10/100 * 190/360),   # Dec FOMC
                datetime(2026, 6, 10): 1.0 / (1 + 4.05/100 * 365/360),    # 1Y
                datetime(2027, 6, 10): 1.0 / (1 + 3.95/100 * 730/360),    # 2Y
                datetime(2028, 6, 10): 1.0 / (1 + 3.71/100 * 1095/360),   # 3Y
            }
            
            # Build step function curve
            step_curve = rl.Curve(
                nodes=nodes,
                interpolation="flat_forward",
                convention="act_360",
                calendar="fed"
            )
            
            # Build smooth curve
            smooth_curve = rl.Curve(
                nodes=nodes,
                interpolation="log_linear",
                convention="act_360",
                calendar="fed"
            )
            
            # Generate forward rates
            dates = []
            step_forwards = []
            smooth_forwards = []
            
            from datetime import timedelta
            
            for days in range(0, 365, 7):
                date = curve_date + timedelta(days=days)
                dates.append(date.isoformat())
                
                # Calculate 1-week forward rates
                try:
                    future_date = date + timedelta(days=7)
                    step_fwd = step_curve.rate(date, future_date)
                    smooth_fwd = smooth_curve.rate(date, future_date)
                    step_forwards.append(float(step_fwd) * 100)
                    smooth_forwards.append(float(smooth_fwd) * 100)
                except Exception as e:
                    # Log the error for debugging
                    print(f"Error calculating rate for {date}: {e}")
                    step_forwards.append(None)
                    smooth_forwards.append(None)
            
            result = {
                "status": "success",
                "message": f"Curves built with rateslib {rl.__version__}",
                "data": {
                    "dates": dates,
                    "step_forwards": step_forwards,
                    "smooth_forwards": smooth_forwards,
                    "fomc_dates": [
                        "2025-06-18", "2025-07-30", "2025-09-17", 
                        "2025-11-05", "2025-12-17"
                    ]
                }
            }
            
        except ImportError as e:
            result = {
                "status": "error",
                "message": "Failed to import rateslib",
                "error": str(e)
            }
        except Exception as e:
            result = {
                "status": "error", 
                "message": "Error building curves",
                "error": str(e)
            }
        
        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS request for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()