from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, func
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
    created_at = Column(DateTime, server_default=func.now(), index=True)

    user = relationship("User", back_populates="reports")
    zone = relationship("Zone", back_populates="reports")
