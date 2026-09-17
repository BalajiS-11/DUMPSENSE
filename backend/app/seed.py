import json
from datetime import datetime, timedelta
from app.database import engine, Base, SessionLocal
from app.models import User, Zone, Report
from app.core.security import get_password_hash

# 8 Real Coimbatore Municipal Wards & Zones (GeoJSON coordinates: [lng, lat])
ZONES_DATA = [
    {
        "name": "Singanallur",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [77.0050, 11.0100],
                [77.0300, 11.0100],
                [77.0300, 10.9900],
                [77.0050, 10.9900],
                [77.0050, 11.0100]
            ]]
        })
    },
    {
        "name": "Ondipudur",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [77.0300, 11.0050],
                [77.0580, 11.0050],
                [77.0580, 10.9850],
                [77.0300, 10.9850],
                [77.0300, 11.0050]
            ]]
        })
    },
    {
        "name": "Vellalore",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9980, 10.9750],
                [77.0300, 10.9750],
                [77.0300, 10.9500],
                [76.9980, 10.9500],
                [76.9980, 10.9750]
            ]]
        })
    },
    {
        "name": "Peelamedu",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9950, 11.0400],
                [77.0300, 11.0400],
                [77.0300, 11.0150],
                [76.9950, 11.0150],
                [76.9950, 11.0400]
            ]]
        })
    },
    {
        "name": "Race Course",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9650, 11.0150],
                [76.9850, 11.0150],
                [76.9850, 10.9980],
                [76.9650, 10.9980],
                [76.9650, 11.0150]
            ]]
        })
    },
    {
        "name": "Gandhipuram",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9550, 11.0280],
                [76.9800, 11.0280],
                [76.9800, 11.0080],
                [76.9550, 11.0080],
                [76.9550, 11.0280]
            ]]
        })
    },
    {
        "name": "RS Puram",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9350, 11.0200],
                [76.9600, 11.0200],
                [76.9600, 10.9950],
                [76.9350, 10.9950],
                [76.9350, 11.0200]
            ]]
        })
    },
    {
        "name": "Saravanampatti",
        "boundary": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [76.9850, 11.0950],
                [77.0250, 11.0950],
                [77.0250, 11.0650],
                [76.9850, 11.0650],
                [76.9850, 11.0950]
            ]]
        })
    }
]

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Checking/Updating Zones...")
        zone_objs = {}
        for z in ZONES_DATA:
            existing = db.query(Zone).filter(Zone.name == z["name"]).first()
            if not existing:
                zone = Zone(name=z["name"], boundary=z["boundary"])
                db.add(zone)
                db.flush()
                zone_objs[z["name"]] = zone
            else:
                existing.boundary = z["boundary"]
                zone_objs[z["name"]] = existing

        # Ensure users exist
        citizen = db.query(User).filter(User.email == "citizen@dumpsense.ai").first()
        if not citizen:
            citizen = User(
                email="citizen@dumpsense.ai",
                password_hash=get_password_hash("password123"),
                role="citizen",
                trust_score=10
            )
            db.add(citizen)
            db.flush()

        officer = db.query(User).filter(User.email == "officer@dumpsense.ai").first()
        if not officer:
            officer = User(
                email="officer@dumpsense.ai",
                password_hash=get_password_hash("password123"),
                role="officer",
                trust_score=50
            )
            db.add(officer)
            db.flush()

        # Seed baseline reports if table is small
        if db.query(Report).count() < 5:
            print("Seeding baseline reports...")
            now = datetime.now()
            seed_reports = [
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Singanallur"].id,
                    "lat": 11.0012,
                    "lng": 77.0195,
                    "photo_url": "/static/seed_fire_1.jpg",
                    "photo_hash": "a1b2c3d4e5f60011",
                    "exif_timestamp": now - timedelta(hours=2),
                    "classification": "open_burning",
                    "confidence": 0.94,
                    "status": "confirmed",
                    "created_at": now - timedelta(hours=2)
                },
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Singanallur"].id,
                    "lat": 11.0045,
                    "lng": 77.0160,
                    "photo_url": "/static/seed_waste_1.jpg",
                    "photo_hash": "a1b2c3d4e5f60022",
                    "exif_timestamp": now - timedelta(hours=5),
                    "classification": "waste_pile",
                    "confidence": 0.88,
                    "status": "unverified",
                    "created_at": now - timedelta(hours=5)
                },
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Ondipudur"].id,
                    "lat": 10.9950,
                    "lng": 77.0410,
                    "photo_url": "/static/seed_fire_2.jpg",
                    "photo_hash": "a1b2c3d4e5f60033",
                    "exif_timestamp": now - timedelta(hours=14),
                    "classification": "open_burning",
                    "confidence": 0.91,
                    "status": "confirmed",
                    "created_at": now - timedelta(hours=14)
                },
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Peelamedu"].id,
                    "lat": 11.0280,
                    "lng": 77.0110,
                    "photo_url": "/static/seed_waste_2.jpg",
                    "photo_hash": "a1b2c3d4e5f60044",
                    "exif_timestamp": now - timedelta(days=1, hours=3),
                    "classification": "open_burning",
                    "confidence": 0.85,
                    "status": "unverified",
                    "created_at": now - timedelta(days=1, hours=3)
                },
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Vellalore"].id,
                    "lat": 10.9650,
                    "lng": 77.0110,
                    "photo_url": "/static/seed_fire_3.jpg",
                    "photo_hash": "a1b2c3d4e5f60055",
                    "exif_timestamp": now - timedelta(days=1, hours=10),
                    "classification": "open_burning",
                    "confidence": 0.96,
                    "status": "confirmed",
                    "created_at": now - timedelta(days=1, hours=10)
                },
                {
                    "user_id": citizen.id,
                    "zone_id": zone_objs["Gandhipuram"].id,
                    "lat": 11.0180,
                    "lng": 76.9690,
                    "photo_url": "/static/seed_waste_3.jpg",
                    "photo_hash": "a1b2c3d4e5f60066",
                    "exif_timestamp": now - timedelta(days=2, hours=1),
                    "classification": "waste_pile",
                    "confidence": 0.82,
                    "status": "unverified",
                    "created_at": now - timedelta(days=2, hours=1)
                }
            ]

            for r in seed_reports:
                rep = Report(
                    user_id=r["user_id"],
                    zone_id=r["zone_id"],
                    lat=r["lat"],
                    lng=r["lng"],
                    location_wkt=f"POINT({r['lng']} {r['lat']})",
                    photo_url=r["photo_url"],
                    photo_hash=r["photo_hash"],
                    exif_timestamp=r["exif_timestamp"],
                    classification=r["classification"],
                    confidence=r["confidence"],
                    status=r["status"],
                    created_at=r["created_at"]
                )
                db.add(rep)

        db.commit()
        print("Database seeded with 8 Coimbatore zones successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
