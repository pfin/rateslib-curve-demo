"""
Test if rateslib can be imported and used in Vercel environment
"""
from http.server import BaseHTTPRequestHandler
import json
import sys
import platform

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Test rateslib availability"""
        result = {
            "python_version": sys.version,
            "platform": platform.platform(),
            "architecture": platform.machine(),
            "rateslib_status": "not_imported"
        }
        
        try:
            import rateslib as rl
            result["rateslib_status"] = "imported"
            result["rateslib_version"] = rl.__version__
            
            # Try to create a simple object
            from datetime import datetime
            curve = rl.Curve(
                nodes={datetime(2025, 1, 1): 1.0},
                interpolation="flat_forward"
            )
            result["curve_test"] = "success"
            
        except ImportError as e:
            result["import_error"] = str(e)
            result["rateslib_status"] = "import_failed"
        except Exception as e:
            result["runtime_error"] = str(e)
            result["error_type"] = type(e).__name__
        
        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result, indent=2).encode())