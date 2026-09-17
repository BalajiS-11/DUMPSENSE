import uuid
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report, User, Zone
from app.schemas import ReportOut, ReportVerifyRequest
from app.core.config import settings
from app.routers.auth import get_optional_current_user, get_current_user
from app.services.antifraud import check_exif_freshness, compute_photo_hash, check_duplicate_photo
from app.services.classifier import classify_image
from app.services.geo import find_matching_zone, haversine_distance_km
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/reports", tags=["Reports"])

def format_report_out(report: Report, db: Session) -> dict:
    zone_name = report.zone.name if report.zone else "Outside Coverage Area"
    trust_score = report.user.trust_score if report.user else None
    return {
        "id": report.id,
        "user_id": report.user_id,
        "zone_id": report.zone_id,
        "zone_name": zone_name,
        "lat": report.lat,
        "lng": report.lng,
        "photo_url": report.photo_url,
        "photo_hash": report.photo_hash,
        "exif_timestamp": report.exif_timestamp,
        "classification": report.classification,
        "confidence": report.confidence,
        "status": report.status,
        "rejection_reason": report.rejection_reason,
        "created_at": report.created_at,
        "reporter_trust_score": trust_score
    }

@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    photo: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Synchronous end-to-end report pipeline:
    1. Saves uploaded image.
    2. EXIF timestamp check (rejects stale photos).
    3. pHash duplicate check (rejects duplicate photos).
    4. YOLOv8 /classify (fire/smoke/waste detection).
    5. Point-in-polygon zone matching.
    6. Persists report with initial status ('unverified' or 'rejected').
    7. Broadcasts event to live WebSocket feed.
    """
    if not photo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # 1. Save uploaded file to uploads directory
    file_ext = Path(photo.filename).suffix or ".jpg"
    filename = f"report_{uuid.uuid4().hex[:12]}{file_ext}"
    filepath = settings.UPLOAD_DIR / filename
    
    contents = await photo.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Determine user ID (default to first citizen in DB if not authenticated)
    user_id = current_user.id if current_user else None
    if not user_id:
        default_citizen = db.query(User).filter(User.role == "citizen").first()
        if default_citizen:
            user_id = default_citizen.id

    # 0. Per-user rate limiting (max 10 reports per hour)
    if user_id:
        one_hour_ago = datetime.now() - timedelta(hours=1)
        recent_count = db.query(Report).filter(
            Report.user_id == user_id,
            Report.created_at >= one_hour_ago
        ).count()
        if recent_count >= 10:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Submission limit exceeded (maximum 10 reports per hour to protect civic trust integrity)."
            )

    # 2. EXIF timestamp freshness check
    exif_timestamp, exif_reason = check_exif_freshness(str(filepath))

    # 3. pHash duplicate check
    photo_hash = compute_photo_hash(str(filepath))
    duplicate_reason = check_duplicate_photo(db, photo_hash)

    # 4. YOLOv8 classification
    cls_result = classify_image(str(filepath))
    classification = cls_result["classification"]
    confidence = cls_result["confidence"]

    # Use annotated image URL if available
    photo_url = cls_result.get("annotated_url") or f"/uploads/{filename}"

    # 5. Zone matching
    zone_id, zone_name = find_matching_zone(db, lat, lng)

    # 6. Status and rejection determination
    rep_status = "unverified"
    rejection_reason = None

    if exif_reason:
        rep_status = "rejected"
        rejection_reason = "stale_photo"
    elif duplicate_reason:
        rep_status = "rejected"
        rejection_reason = "duplicate_photo"
    elif confidence < 0.20:
        rep_status = "rejected"
        rejection_reason = "low_confidence"

    # 7. Persist to DB
    new_report = Report(
        user_id=user_id,
        zone_id=zone_id,
        lat=lat,
        lng=lng,
        location_wkt=f"POINT({lng} {lat})",
        photo_url=photo_url,
        photo_hash=photo_hash,
        exif_timestamp=exif_timestamp,
        classification=classification,
        confidence=confidence,
        status=rep_status,
        rejection_reason=rejection_reason,
        created_at=datetime.now()
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    # 7b. Corroboration logic: auto-confirm if another report exists within 200m & 24h
    if new_report.status == "unverified":
        one_day_ago = datetime.now() - timedelta(hours=24)
        candidates = db.query(Report).filter(
            Report.id != new_report.id,
            Report.status.in_(["unverified", "confirmed"]),
            Report.created_at >= one_day_ago
        ).all()

        corroborated_existing = None
        for cand in candidates:
            dist_km = haversine_distance_km(new_report.lat, new_report.lng, cand.lat, cand.lng)
            if dist_km <= 0.200:  # within 200 meters
                new_report.status = "confirmed"
                if cand.status == "unverified":
                    cand.status = "confirmed"
                    corroborated_existing = cand
                break

        db.commit()
        db.refresh(new_report)

        if corroborated_existing:
            cand_dict = format_report_out(corroborated_existing, db)
            cand_broadcast = cand_dict.copy()
            if cand_broadcast["exif_timestamp"]:
                cand_broadcast["exif_timestamp"] = cand_broadcast["exif_timestamp"].isoformat()
            if cand_broadcast["created_at"]:
                cand_broadcast["created_at"] = cand_broadcast["created_at"].isoformat()
            await ws_manager.broadcast({
                "type": "REPORT_VERIFIED",
                "data": cand_broadcast
            })

    # 8. Broadcast to WebSocket clients
    report_dict = format_report_out(new_report, db)
    # Serialize datetime for JSON broadcast
    broadcast_data = report_dict.copy()
    if broadcast_data["exif_timestamp"]:
        broadcast_data["exif_timestamp"] = broadcast_data["exif_timestamp"].isoformat()
    if broadcast_data["created_at"]:
        broadcast_data["created_at"] = broadcast_data["created_at"].isoformat()

    await ws_manager.broadcast({
        "type": "REPORT_CREATED",
        "data": broadcast_data
    })

    return report_dict

@router.get("", response_model=List[ReportOut])
def get_reports(
    zone_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List reports, filterable by zone_id, status ('unverified', 'confirmed', 'rejected'), and date.
    """
    query = db.query(Report)

    if zone_id:
        query = query.filter(Report.zone_id == zone_id)
    if status:
        query = query.filter(Report.status == status)
    if date:
        try:
            filter_date = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(Report.created_at >= filter_date)
        except ValueError:
            pass

    reports = query.order_by(Report.created_at.desc()).all()
    return [format_report_out(r, db) for r in reports]

@router.get("/{report_id}", response_model=ReportOut)
def get_report_detail(report_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a single report.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found"
        )
    return format_report_out(report, db)

@router.patch("/{report_id}/verify", response_model=ReportOut)
async def verify_report(
    report_id: int,
    verify_req: ReportVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Officer confirms or rejects a report:
    - confirm: status='confirmed', citizen trust_score += 2
    - reject: status='rejected', citizen trust_score -= 5
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found"
        )

    action = verify_req.action.lower()
    if action not in ["confirm", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'confirm' or 'reject'"
        )

    if action == "confirm":
        report.status = "confirmed"
        report.rejection_reason = None
        if report.user:
            report.user.trust_score = (report.user.trust_score or 10) + 2
    else:  # reject
        report.status = "rejected"
        report.rejection_reason = verify_req.rejection_reason or "rejected_by_officer"
        if report.user:
            report.user.trust_score = max(0, (report.user.trust_score or 10) - 5)

    db.commit()
    db.refresh(report)

    # Broadcast verification update to live clients
    report_dict = format_report_out(report, db)
    broadcast_data = report_dict.copy()
    if broadcast_data["exif_timestamp"]:
        broadcast_data["exif_timestamp"] = broadcast_data["exif_timestamp"].isoformat()
    if broadcast_data["created_at"]:
        broadcast_data["created_at"] = broadcast_data["created_at"].isoformat()

    await ws_manager.broadcast({
        "type": "REPORT_VERIFIED",
        "data": broadcast_data
    })

    return report_dict
