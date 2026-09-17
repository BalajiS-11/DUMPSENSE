from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str
    user_id: int
    trust_score: int

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "citizen"

class UserLogin(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    role: str
    trust_score: int
    created_at: datetime

    class Config:
        from_attributes = True

class ZoneOut(BaseModel):
    id: int
    name: str
    boundary: Optional[str] = None

    class Config:
        from_attributes = True

class DetectionBox(BaseModel):
    box: List[float]  # [x1, y1, x2, y2]
    label: str
    confidence: float

class ClassifyResult(BaseModel):
    classification: str  # waste_pile | open_burning | clean
    confidence: float
    detections: List[DetectionBox] = []
    annotated_url: Optional[str] = None

class ReportOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    zone_id: Optional[int] = None
    zone_name: Optional[str] = None
    lat: float
    lng: float
    photo_url: str
    photo_hash: str
    exif_timestamp: Optional[datetime] = None
    classification: Optional[str] = None
    confidence: Optional[float] = None
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    reporter_trust_score: Optional[int] = None

    class Config:
        from_attributes = True

class ReportVerifyRequest(BaseModel):
    action: str  # confirm | reject
    rejection_reason: Optional[str] = None

class HotspotCluster(BaseModel):
    id: int
    lat: float
    lng: float
    intensity: float  # 0.0 to 1.0
    radius_meters: float
    risk_level: str  # low | medium | high | severe
    zone_name: str
    report_count: int
    night_risk_score: float

class HotspotPredictionResponse(BaseModel):
    generated_at: str
    forecast_window: str  # "Next 24-48 Hours (Overnight Focus: 22:00 - 05:00)"
    overall_city_risk: str
    top_risk_zones: List[Dict[str, Any]]
    clusters: List[HotspotCluster]
