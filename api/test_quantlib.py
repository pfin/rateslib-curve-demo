"""
Test if QuantLib can be imported and used in Vercel environment
"""
from http.server import BaseHTTPRequestHandler
import json
import sys
import platform
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Test QuantLib availability"""
        result = {
            "python_version": sys.version,
            "platform": platform.platform(),
            "architecture": platform.machine(),
            "quantlib_status": "not_imported",
            "test_date": datetime.now().isoformat()
        }
        
        try:
            # Try to import QuantLib
            import QuantLib as ql
            result["quantlib_status"] = "imported"
            result["quantlib_version"] = ql.__version__
            
            # Try to create a simple curve
            # Set evaluation date
            today = ql.Date(10, 6, 2025)
            ql.Settings.instance().evaluationDate = today
            
            # Create some market data
            tenors = [ql.Period(1, ql.Months), ql.Period(3, ql.Months), 
                      ql.Period(6, ql.Months), ql.Period(1, ql.Years)]
            rates = [0.0431, 0.0432, 0.0427, 0.0409]
            
            # Create helpers for curve construction
            calendar = ql.UnitedStates(ql.UnitedStates.FederalReserve)
            helpers = []
            
            for tenor, rate in zip(tenors, rates):
                # Create OIS helpers (similar to SOFR swaps)
                helper = ql.OISRateHelper(
                    2,  # settlement days
                    tenor,
                    ql.QuoteHandle(ql.SimpleQuote(rate)),
                    ql.Sofr()  # SOFR index
                )
                helpers.append(helper)
            
            # Build the curve
            curve = ql.PiecewiseLogLinearDiscount(today, helpers, ql.Actual360())
            curve.enableExtrapolation()
            
            # Test the curve - get some discount factors
            test_dates = [
                today + ql.Period(1, ql.Weeks),
                today + ql.Period(1, ql.Months),
                today + ql.Period(3, ql.Months),
                today + ql.Period(6, ql.Months),
                today + ql.Period(1, ql.Years)
            ]
            
            discount_factors = []
            for date in test_dates:
                df = curve.discount(date)
                discount_factors.append({
                    "date": str(date),
                    "df": float(df),
                    "zero_rate": float(curve.zeroRate(date, ql.Actual360(), ql.Continuous).rate())
                })
            
            result["curve_test"] = "success"
            result["curve_details"] = {
                "reference_date": str(curve.referenceDate()),
                "calendar": "US Federal Reserve",
                "day_counter": "Actual/360",
                "interpolation": "LogLinear on discount factors",
                "sample_results": discount_factors[:3]  # Just first 3 for brevity
            }
            
        except ImportError as e:
            result["import_error"] = str(e)
            result["quantlib_status"] = "import_failed"
            result["suggestion"] = "QuantLib requires C++ compilation, similar to rateslib's Rust requirements"
        except Exception as e:
            result["runtime_error"] = str(e)
            result["error_type"] = type(e).__name__
        
        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result, indent=2).encode())