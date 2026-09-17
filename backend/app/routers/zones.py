from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Zone
from app.schemas import ZoneOut, OfficialZoneOut

router = APIRouter(prefix="/zones", tags=["Zones"])

@router.get("/official", response_model=List[OfficialZoneOut])
def get_official_zones(db: Session = Depends(get_db)):
    """
    Public endpoint returning all 17 official CCMC C&D waste collection points.
    No authentication required.
    """
    zones = (
        db.query(Zone)
        .filter(Zone.is_official_ccmc == True)
        .order_by(Zone.ward_number.asc(), Zone.id.asc())
        .all()
    )
    return zones

@router.get("", response_model=List[ZoneOut])
def get_all_zones(db: Session = Depends(get_db)):
    """
    Public endpoint returning all registered zones (monitored areas and official points).
    """
    zones = db.query(Zone).order_by(Zone.id.asc()).all()
    return zones
