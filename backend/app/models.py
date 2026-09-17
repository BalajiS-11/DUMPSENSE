from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="citizen")  # citizen | officer
    trust_score = Column(Integer, default=10)
    created_at = Column(DateTime, server_default=func.now())

    reports = relationship("Report", back_populates="user")

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # Singanallur, Ondipudur, Vellalore
    boundary = Column(Text, nullable=True)  # GeoJSON / WKT polygon coordinates
    zone_type = Column(String(30), default="monitored_area")  # monitored_area | official_cd_point
    ward_number = Column(Integer, nullable=True)
    full_address = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    is_official_ccmc = Column(Boolean, default=False)

    reports = relationship("Report", back_populates="zone")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    location_wkt = Column(String(100), nullable=True)  # POINT(lng lat)
    photo_url = Column(String(255), nullable=False)
    photo_hash = Column(String(64), nullable=False, index=True)  # perceptual hash
    exif_timestamp = Column(DateTime, nullable=True)
    classification = Column(String(50), nullable=True)  # waste_pile | open_burning | clean
    confidence = Column(Float, nullable=True)
    status = Column(String(20), default="unverified", index=True)  # unverified | confirmed | rejected
    rejection_reason = Column(String(100), nullable=True)  # stale_photo | duplicate_photo | low_confidence
    description = Column(Text, nullable=True)
    citizen_classification = Column(String(30), nullable=True)  # Open Burning | Waste Pile | Both
    estimated_size = Column(String(20), nullable=True)
    is_anonymous = Column(Boolean, default=False)
    severity_boost = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    user = relationship("User", back_populates="reports")
    zone = relationship("Zone", back_populates="reports")
    timeline_entries = relationship("ReportTimeline", back_populates="report", cascade="all, delete-orphan", order_by="ReportTimeline.created_at.asc()")

class ReportTimeline(Base):
    __tablename__ = "report_timeline"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    stage = Column(String(50), nullable=False)  # submitted | ai_verified | officer_reviewed | action_taken
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    report = relationship("Report", back_populates="timeline_entries")
