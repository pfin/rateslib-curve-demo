"""
Simple QuantLib test - minimal imports
"""
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Simple QuantLib test"""
        result = {"status": "starting"}
        
        try:
            # Just try to import QuantLib
            import QuantLib as ql
            result["import"] = "success"
            result["version"] = ql.__version__
            
            # Try one simple operation
            today = ql.Date(10, 6, 2025)
            result["date_test"] = str(today)
            result["message"] = f"QuantLib {ql.__version__} works on Vercel!"
            
        except ImportError as e:
            result["import"] = "failed"
            result["error"] = str(e)
            result["message"] = "QuantLib import failed"
        except Exception as e:
            result["import"] = "success"
            result["runtime_error"] = str(e)
            result["message"] = "QuantLib imported but error in usage"
        
        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())