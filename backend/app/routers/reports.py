import io
import uuid
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report, User, Zone, ReportTimeline
from app.schemas import ReportOut, ReportVerifyRequest, TimelineEntryOut, ShareCardOut
from app.core.config import settings
from app.routers.auth import get_optional_current_user, get_current_user
from app.services.antifraud import check_exif_freshness, compute_photo_hash, check_duplicate_photo
from app.services.classifier import classify_image
from app.services.geo import find_matching_zone, haversine_distance_km
from app.services.websocket_manager import ws_manager
from app.services.pdf_generator import generate_enforcement_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])

def format_report_out(report: Report, db: Session) -> dict:
    zone_name = report.zone.name if report.zone else "Outside Coverage Area"
    trust_score = report.user.trust_score if report.user else None
    reporter_name = "Anonymous Citizen" if getattr(report, "is_anonymous", False) else (report.user.email if report.user else "Citizen")
    
    cls_str = report.classification or ""
    if cls_str in ["open_burning", "fire"]:
        detecting_model = "Fire Detection Model (YOLOv8 best.pt)"
    elif cls_str == "waste_pile":
        detecting_model = "Waste Pile Model (YOLOv8 best2.pt)"
    else:
        detecting_model = "CCMC Civic AI Model"

    return {
        "id": report.id,
        "user_id": report.user_id,
        "zone_id": report.zone_id,
        "zone_name": zone_name,
        "lat": report.lat,
        "lng": report.lng,
        "photo_url": report.photo_url,
        "annotated_url": report.photo_url,
        "photo_hash": report.photo_hash,
        "exif_timestamp": report.exif_timestamp,
        "classification": report.classification,
        "confidence": report.confidence,
        "status": report.status,
        "rejection_reason": report.rejection_reason,
        "description": getattr(report, "description", None),
        "citizen_classification": getattr(report, "citizen_classification", None),
        "estimated_size": getattr(report, "estimated_size", None),
        "is_anonymous": getattr(report, "is_anonymous", False),
        "severity_boost": getattr(report, "severity_boost", 0),
        "reporter_name": reporter_name,
        "created_at": report.created_at,
        "reporter_trust_score": trust_score,
        "detecting_model": detecting_model
    }

@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    photo: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    description: Optional[str] = Form(None),
    citizen_classification: Optional[str] = Form(None),
    estimated_size: Optional[str] = Form(None),
    is_anonymous: bool = Form(False),
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
    elif confidence is None or confidence < 0.20:
        rep_status = "rejected"
        rejection_reason = "low_confidence"

    # 7. Compute severity boost from description keywords (Part 7)
    severity_boost = 0
    if description:
        keywords = ["large", "hospital", "overnight", "chemical", "factory", "burning since", "days", "week", "school", "children"]
        desc_lower = description.lower()
        matched = [kw for kw in keywords if kw in desc_lower]
        if len(matched) >= 2:
            severity_boost = 3
        elif len(matched) == 1:
            severity_boost = 2

    # 8. Persist to DB
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
        description=description,
        citizen_classification=citizen_classification,
        estimated_size=estimated_size,
        is_anonymous=is_anonymous,
        severity_boost=severity_boost,
        created_at=datetime.now()
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    # 9. Auto-insert real timeline entries (Part 4)
    # Stage 1: submitted
    t_submitted = ReportTimeline(
        report_id=new_report.id,
        stage="submitted",
        note="Report submitted by citizen",
        created_at=new_report.created_at
    )
    db.add(t_submitted)

    # Stage 2: ai_verified
    if classification == "open_burning":
        conf_pct = int(confidence * 100) if confidence else 0
        ai_note = f"AI detected open_burning at {conf_pct}% confidence"
    elif classification == "waste_pile":
        conf_pct = int(confidence * 100) if confidence else 0
        ai_note = f"AI detected waste_pile at {conf_pct}% confidence"
    else:
        ai_note = "AI detected clean (no violation detected)"

    t_ai = ReportTimeline(
        report_id=new_report.id,
        stage="ai_verified",
        note=ai_note,
        created_at=new_report.created_at
    )
    db.add(t_ai)
    db.commit()

    # 10. Corroboration logic: auto-confirm if another report exists within 200m & 24h
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
                "event": "report_updated",
                "report": cand_broadcast,
                "type": "REPORT_VERIFIED",
                "data": cand_broadcast
            })

    # 11. Broadcast to WebSocket clients (Fix 1: event: report_created)
    report_dict = format_report_out(new_report, db)
    broadcast_data = report_dict.copy()
    if broadcast_data["exif_timestamp"]:
        broadcast_data["exif_timestamp"] = broadcast_data["exif_timestamp"].isoformat()
    if broadcast_data["created_at"]:
        broadcast_data["created_at"] = broadcast_data["created_at"].isoformat()

    await ws_manager.broadcast({
        "event": "report_created",
        "report": broadcast_data,
        "type": "REPORT_CREATED",
        "data": broadcast_data
    })

    return report_dict

@router.get("", response_model=List[ReportOut])
def get_reports(
    zone_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List reports, filterable by zone_id, user_id, status (comma-separated e.g. 'confirmed,unverified'), and date.
    """
    query = db.query(Report)

    if zone_id:
        query = query.filter(Report.zone_id == zone_id)
    if user_id:
        query = query.filter(Report.user_id == user_id)
    if status:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if len(status_list) == 1:
            query = query.filter(Report.status == status_list[0])
        elif len(status_list) > 1:
            query = query.filter(Report.status.in_(status_list))
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

@router.get("/{report_id}/pdf")
def get_report_pdf(report_id: int, db: Session = Depends(get_db)):
    """
    FIX 3 — PDF Enforcement Action Dossier (ReportLab server-side generation).
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found"
        )

    # Resolve physical image path on disk
    image_path = None
    if report.photo_url:
        rel_path = report.photo_url.lstrip("/")
        if rel_path.startswith("uploads/"):
            rel_path = rel_path[len("uploads/"):]
        cand = settings.UPLOAD_DIR / rel_path
        if cand.exists():
            image_path = str(cand)

    zone_name = report.zone.name if report.zone else "Outside Coverage Area"
    ward_number = report.zone.ward_number if report.zone else None
    formatted_created = report.created_at.strftime("%d %b %Y, %I:%M %p") if report.created_at else "17 Sep 2026, 8:43 PM"

    pdf_bytes = generate_enforcement_pdf(
        report_id=report.id,
        zone_name=zone_name,
        ward_number=ward_number,
        lat=report.lat,
        lng=report.lng,
        created_at_str=formatted_created,
        classification=report.classification or "waste_pile",
        confidence=report.confidence or 0.0,
        severity_boost=getattr(report, "severity_boost", 0) or 0,
        image_path=image_path
    )

    filename = f"DumpSense_Enforcement_DS-2026-{report.id:05d}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/{report_id}/timeline", response_model=List[TimelineEntryOut])
def get_report_timeline(report_id: int, db: Session = Depends(get_db)):
    """
    Returns real report timeline stages ordered chronologically (Part 4).
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found"
        )
    entries = db.query(ReportTimeline).filter(
        ReportTimeline.report_id == report_id
    ).order_by(ReportTimeline.created_at.asc()).all()
    return entries

@router.get("/{report_id}/share-card", response_model=ShareCardOut)
def get_share_card(report_id: int, db: Session = Depends(get_db)):
    """
    FIX 5 — WhatsApp Share Card data endpoint with official dossier markdown formatting.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found"
        )
    zone_name = report.zone.name if report.zone else "Coimbatore"
    conf_pct = int(round(report.confidence * 100)) if report.confidence else 0
    classification_str = report.classification or "open_burning"
    is_burning = "burn" in classification_str or "fire" in classification_str
    classification_label = "Open Burning 🔥" if is_burning else "Waste Pile 🗑️"

    conf_val = report.confidence or 0.0
    if conf_val >= 0.80 and is_burning:
        priority = "HIGH"
    elif conf_val >= 0.60 or classification_str == "waste_pile":
        priority = "MEDIUM"
    else:
        priority = "LOW"

    formatted_datetime = report.created_at.strftime("%d %b %Y, %I:%M %p") if report.created_at else "17 Sep 2026, 8:43 PM"

    share_text = (
        f"🚨 *MUNICIPAL ENFORCEMENT ALERT*\n"
        f"📋 File No: DS-2026-{report.id:05d}\n\n"
        f"*Unauthorized waste dumping detected*\n"
        f"📍 Zone: {zone_name}, Coimbatore\n"
        f"🤖 AI Detection: {classification_label} — {conf_pct}% confidence (YOLOv8)\n"
        f"⚠️ Action Priority: {priority}\n"
        f"📅 Detected: {formatted_datetime}\n\n"
        f"*Statutory Authority:*\n"
        f"Sept 2026 NGT Ruling — Mandatory surveillance of Singanallur, Ondipudur & Vellalore dump zones.\n\n"
        f"_Reported via DumpSense Citizen Surveillance App_\n"
        f"_CCMC Sanitary Surveillance // TNPCB Compliance_\n\n"
        f"🔗 View full enforcement dossier: http://127.0.0.1:5173/reports/{report.id}"
    )

    return {
        "report_id": report.id,
        "classification": classification_str,
        "confidence": conf_pct,
        "zone_name": zone_name,
        "created_at": report.created_at,
        "status": report.status,
        "share_text": share_text
    }

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
    - Automatically records officer_reviewed and action_taken timeline entries
    - FIX 1: Broadcasts 'report_updated' event to WebSocket clients
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
        officer_note = "Confirmed by Ward Officer"
    else:  # reject
        report.status = "rejected"
        report.rejection_reason = verify_req.rejection_reason or "rejected_by_officer"
        if report.user:
            report.user.trust_score = max(0, (report.user.trust_score or 10) - 5)
        officer_note = f"Rejected: {report.rejection_reason}"

    # Stage 3: officer_reviewed
    t_review = ReportTimeline(
        report_id=report.id,
        stage="officer_reviewed",
        note=officer_note,
        created_at=datetime.now()
    )
    db.add(t_review)

    # Stage 4: action_taken (inserted automatically 2h after officer_reviewed if confirmed)
    if action == "confirm":
        t_action = ReportTimeline(
            report_id=report.id,
            stage="action_taken",
            note="Report forwarded to CCMC waste management unit",
            created_at=datetime.now() + timedelta(hours=2)
        )
        db.add(t_action)

    db.commit()
    db.refresh(report)

    # Broadcast verification update to live clients (Fix 1: event: report_updated)
    report_dict = format_report_out(report, db)
    broadcast_data = report_dict.copy()
    if broadcast_data["exif_timestamp"]:
        broadcast_data["exif_timestamp"] = broadcast_data["exif_timestamp"].isoformat()
    if broadcast_data["created_at"]:
        broadcast_data["created_at"] = broadcast_data["created_at"].isoformat()

    await ws_manager.broadcast({
        "event": "report_updated",
        "report": broadcast_data,
        "type": "REPORT_VERIFIED",
        "data": broadcast_data
    })

    return report_dict
