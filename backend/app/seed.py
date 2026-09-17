import json
from datetime import datetime, timedelta
from app.database import engine, Base, SessionLocal
from app.models import User, Zone, Report
from app.core.security import get_password_hash

# 8 Real Coimbatore Municipal Monitored Areas (GeoJSON polygon coordinates: [lng, lat])
MONITORED_ZONES_DATA = [
    {
        "name": "Singanallur",
        "ward_number": 62,
        "full_address": "Singanallur Commercial & Residential Ward Area, Coimbatore",
        "lat": 11.0020,
        "lng": 77.0180,
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
        "ward_number": 57,
        "full_address": "Ondipudur Industrial & Transit Zone, Coimbatore",
        "lat": 10.9950,
        "lng": 77.0440,
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
        "ward_number": 98,
        "full_address": "Vellalore Dump Yard & Buffer Zone, Coimbatore",
        "lat": 10.9620,
        "lng": 77.0140,
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
        "ward_number": 38,
        "full_address": "Peelamedu Educational & Tech Corridor, Coimbatore",
        "lat": 11.0275,
        "lng": 77.0125,
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
        "ward_number": 70,
        "full_address": "Race Course Central Urban Zone, Coimbatore",
        "lat": 11.0065,
        "lng": 76.9750,
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
        "ward_number": 49,
        "full_address": "Gandhipuram Commercial Central Hub, Coimbatore",
        "lat": 11.0180,
        "lng": 76.9675,
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
        "ward_number": 72,
        "full_address": "RS Puram Commercial & Residential Hub, Coimbatore",
        "lat": 11.0075,
        "lng": 76.9475,
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
        "ward_number": 14,
        "full_address": "Saravanampatti IT & Institutional Zone, Coimbatore",
        "lat": 11.0800,
        "lng": 77.0050,
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

# 17 Official CCMC Commissioner-Signed C&D Waste Collection Points
# Coordinates strictly bounded by Coimbatore: Lat [10.95, 11.10], Lng [76.92, 77.12]
CCMC_OFFICIAL_ZONES = [
    {
        "name": "Singanallur Old Bus Stand Municipal Yard",
        "ward_number": 62,
        "full_address": "Near Old Bus Stand, Kamarajar Road, Singanallur, Coimbatore - 641005",
        "lat": 11.0015,
        "lng": 77.0182,
    },
    {
        "name": "Ondipudur STP C&D Collection Facility",
        "ward_number": 57,
        "full_address": "Coimbatore Corporation STP Complex, Trichy Road, Ondipudur - 641016",
        "lat": 10.9982,
        "lng": 77.0354,
    },
    {
        "name": "Vellalore Integrated C&D Processing Plant",
        "ward_number": 98,
        "full_address": "Coimbatore City Municipal Corporation Dump Yard Road, Vellalore - 641111",
        "lat": 10.9542,
        "lng": 77.0125,
    },
    {
        "name": "Peelamedu CCMC Ward Civil Depot",
        "ward_number": 38,
        "full_address": "Near Codissia Road, Behind PSG Tech, Peelamedu, Coimbatore - 641004",
        "lat": 11.0285,
        "lng": 77.0092,
    },
    {
        "name": "Ukkadam STP & Sungam Bypass Collection Hub",
        "ward_number": 86,
        "full_address": "Sungam Bypass Road, Opposite Valankulam Lake, Ukkadam, Coimbatore - 641001",
        "lat": 10.9902,
        "lng": 76.9628,
    },
    {
        "name": "RS Puram Micro Composting & C&D Yard",
        "ward_number": 72,
        "full_address": "Diwan Bahadur Road, Near Lawley Road Junction, RS Puram, Coimbatore - 641002",
        "lat": 11.0112,
        "lng": 76.9458,
    },
    {
        "name": "Gandhipuram Central Transfer Station",
        "ward_number": 49,
        "full_address": "Cross Cut Road, 7th Street Corner, Gandhipuram, Coimbatore - 641012",
        "lat": 11.0184,
        "lng": 76.9685,
    },
    {
        "name": "Saravanampatti Sathy Road Municipal Depot",
        "ward_number": 14,
        "full_address": "Sathy Road, Near CHIL SEZ IT Park, Saravanampatti, Coimbatore - 641035",
        "lat": 11.0782,
        "lng": 77.0012,
    },
    {
        "name": "Ganapathy Athipalayam Zonal C&D Yard",
        "ward_number": 28,
        "full_address": "Athipalayam Road, Near Corporation Elementary School, Ganapathy - 641006",
        "lat": 11.0425,
        "lng": 76.9854,
    },
    {
        "name": "Kuniyamuthur Sewage Pumping Grounds",
        "ward_number": 92,
        "full_address": "Palakkad Main Road, Near Kovaipudur Pirivu, Kuniyamuthur - 641008",
        "lat": 10.9654,
        "lng": 76.9482,
    },
    {
        "name": "Thudiyalur Mettupalayam Road Municipal Yard",
        "ward_number": 2,
        "full_address": "Mettupalayam Main Road, Near Rythu Santhai, Thudiyalur - 641034",
        "lat": 11.0825,
        "lng": 76.9421,
    },
    {
        "name": "Ramanathapuram Municipal Transfer Yard",
        "ward_number": 64,
        "full_address": "Trichy Road, Near Alvernia Convent, Ramanathapuram, Coimbatore - 641045",
        "lat": 10.9945,
        "lng": 76.9890,
    },
    {
        "name": "Saibaba Colony Western Municipal Depot",
        "ward_number": 42,
        "full_address": "NSR Road, Near Corporation Zonal Office, Saibaba Colony - 641011",
        "lat": 11.0268,
        "lng": 76.9412,
    },
    {
        "name": "Kovaipudur Municipal Reserve Facility",
        "ward_number": 88,
        "full_address": "Ashram Road, Block 4 Reserve Site, Kovaipudur, Coimbatore - 641042",
        "lat": 10.9520,
        "lng": 76.9380,
    },
    {
        "name": "Vadavalli Marudhamalai Road C&D Point",
        "ward_number": 35,
        "full_address": "Marudhamalai Main Road, Near Maharani Avenue, Vadavalli - 641041",
        "lat": 11.0245,
        "lng": 76.9250,
    },
    {
        "name": "Kurichi Housing Unit Municipal Depot",
        "ward_number": 95,
        "full_address": "Pollachi Main Road, Phase 2 Housing Unit, Kurichi - 641024",
        "lat": 10.9620,
        "lng": 76.9740,
    },
    {
        "name": "Hopes College Avinashi Road Civil Yard",
        "ward_number": 45,
        "full_address": "Avinashi Road, Near Civil Aerodrome Post, Hopes College - 641014",
        "lat": 11.0310,
        "lng": 77.0250,
    }
]

def make_buffer_polygon(lat: float, lng: float, delta: float = 0.002):
    return json.dumps({
        "type": "Polygon",
        "coordinates": [[
            [round(lng - delta, 5), round(lat - delta, 5)],
            [round(lng + delta, 5), round(lat - delta, 5)],
            [round(lng + delta, 5), round(lat + delta, 5)],
            [round(lng - delta, 5), round(lat + delta, 5)],
            [round(lng - delta, 5), round(lat - delta, 5)],
        ]]
    })

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Checking/Updating Monitored Zones...")
        for z in MONITORED_ZONES_DATA:
            existing = db.query(Zone).filter(Zone.name == z["name"]).first()
            if not existing:
                zone = Zone(
                    name=z["name"],
                    boundary=z["boundary"],
                    zone_type="monitored_area",
                    ward_number=z.get("ward_number"),
                    full_address=z.get("full_address"),
                    lat=z.get("lat"),
                    lng=z.get("lng"),
                    is_official_ccmc=False
                )
                db.add(zone)
            else:
                existing.boundary = z["boundary"]
                existing.zone_type = "monitored_area"
                existing.ward_number = z.get("ward_number")
                existing.full_address = z.get("full_address")
                existing.lat = z.get("lat")
                existing.lng = z.get("lng")
                existing.is_official_ccmc = False

        print("Seeding 17 Official CCMC C&D Waste Collection Points...")
        for oz in CCMC_OFFICIAL_ZONES:
            existing = db.query(Zone).filter(Zone.name == oz["name"]).first()
            polygon = make_buffer_polygon(oz["lat"], oz["lng"])
            if not existing:
                zone = Zone(
                    name=oz["name"],
                    boundary=polygon,
                    zone_type="official_cd_point",
                    ward_number=oz["ward_number"],
                    full_address=oz["full_address"],
                    lat=oz["lat"],
                    lng=oz["lng"],
                    is_official_ccmc=True
                )
                db.add(zone)
            else:
                existing.boundary = polygon
                existing.zone_type = "official_cd_point"
                existing.ward_number = oz["ward_number"]
                existing.full_address = oz["full_address"]
                existing.lat = oz["lat"]
                existing.lng = oz["lng"]
                existing.is_official_ccmc = True

        # Ensure demo users exist
        citizen = db.query(User).filter(User.email == "citizen@dumpsense.ai").first()
        if not citizen:
            citizen = User(
                email="citizen@dumpsense.ai",
                password_hash=get_password_hash("password123"),
                role="citizen",
                trust_score=10
            )
            db.add(citizen)

        officer = db.query(User).filter(User.email == "officer@dumpsense.ai").first()
        if not officer:
            officer = User(
                email="officer@dumpsense.ai",
                password_hash=get_password_hash("password123"),
                role="officer",
                trust_score=50
            )
            db.add(officer)

        db.commit()
        official_count = db.query(Zone).filter(Zone.is_official_ccmc == True).count()
        total_zones = db.query(Zone).count()
        print(f"Database seeded successfully: {official_count} official CCMC points, {total_zones} total zones.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
