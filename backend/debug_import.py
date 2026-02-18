import sys
import os
sys.path.append(os.getcwd())
try:
    from app.main import app
    print("Import successful")
except Exception:
    import traceback
    traceback.print_exc()
