"""
Simple rateslib test - minimal imports
"""
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Simple rateslib test"""
        result = {"status": "starting"}
        
        try:
            # Just try to import rateslib
            import rateslib as rl
            result["import"] = "success"
            result["version"] = rl.__version__
            
            # Try one simple operation
            from datetime import datetime
            curve = rl.Curve(
                nodes={datetime(2025, 6, 10): 1.0},
                interpolation="flat_forward"
            )
            result["curve_test"] = "success"
            result["message"] = f"rateslib {rl.__version__} works on Vercel!"
            
        except ImportError as e:
            result["import"] = "failed"
            result["error"] = str(e)
            result["message"] = "rateslib import failed"
        except Exception as e:
            result["import"] = "success"
            result["runtime_error"] = str(e)
            result["message"] = "rateslib imported but error in usage"
        
        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())