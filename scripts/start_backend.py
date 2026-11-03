"""Backend Launcher Script for Federated Healthcare Security."""

import os
import sys
from pathlib import Path

# Add project root and backend dir to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

import uvicorn

if __name__ == "__main__":
    print("Starting Federated Healthcare Security FastAPI Server on http://127.0.0.1:8000 ...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=False)
