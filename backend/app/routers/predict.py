from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import HotspotPredictionResponse
from app.services.predictor import compute_hotspot_predictions

router = APIRouter(tags=["Predictions"])

@router.get("/predict-hotspots", response_model=HotspotPredictionResponse)
def get_predict_hotspots(db: Session = Depends(get_db)):
    """
    Returns spatial clusters (DBSCAN) and 24-48h temporal risk forecasting
    per zone in Coimbatore, with overnight burning risk ratings.
    """
    return compute_hotspot_predictions(db)
