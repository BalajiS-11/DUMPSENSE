import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, classify, reports, predict, ws, zones

app = FastAPI(
    title="DumpSense AI API",
    description="Real-Time Open Burning & Waste Dump Detection and Prediction Engine for Coimbatore",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload and static directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
static_dir = Path(__file__).resolve().parent.parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Mount Routers
app.include_router(auth.router)
app.include_router(classify.router)
app.include_router(reports.router)
app.include_router(predict.router)
app.include_router(ws.router)
app.include_router(zones.router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DumpSense AI",
        "version": "1.0.0"
    }
