import sys
import os
import traceback

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from seed_org import seed_org
    seed_org()
except Exception:
    traceback.print_exc()
