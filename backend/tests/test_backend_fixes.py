import io
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.services.geo import find_matching_zone

client = TestClient(app)

import random
import time

def create_distinct_image(tag: str) -> bytes:
    # Use random noise and unique shapes so pHash is completely unique
    img = Image.new("RGB", (320, 240), color=(random.randint(50, 230), random.randint(30, 200), random.randint(30, 200)))
    d = ImageDraw.Draw(img)
    for _ in range(15):
        x1, y1 = random.randint(0, 280), random.randint(0, 200)
        x2, y2 = x1 + random.randint(20, 60), y1 + random.randint(20, 60)
        d.rectangle([x1, y1, x2, y2], fill=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)))
    d.text((10, 10), f"{tag}_{time.time()}_{random.random()}", fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_outside_coverage():
    db = SessionLocal()
    try:
        # Dindigul coordinates (~75 km from Coimbatore)
        zone_id, zone_name = find_matching_zone(db, 10.3673, 77.9803)
        print("Dindigul zone match result:", zone_id, zone_name)
        assert zone_id is None
        assert zone_name == "Outside Coverage Area"
        print("Outside Coverage Area test PASSED!")

        # Coimbatore Singanallur coordinates
        cbe_zone_id, cbe_zone_name = find_matching_zone(db, 11.0010, 77.0190)
        print("Coimbatore zone match result:", cbe_zone_id, cbe_zone_name)
        assert cbe_zone_id is not None
        assert cbe_zone_name == "Singanallur"
        print("Coimbatore Real Zone test PASSED!")
    finally:
        db.close()

def test_corroboration_logic():
    # Login citizen
    login_res = client.post("/auth/login", json={
        "email": "citizen@dumpsense.ai",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Pick an unoccupied coordinate in RS Puram (11.0095, 76.9475)
    img_bytes1 = create_distinct_image("fresh_fire_1")
    res1 = client.post(
        "/reports",
        data={"lat": "11.0095", "lng": "76.9475"},
        files={"photo": ("fire_unique_1.jpg", img_bytes1, "image/jpeg")},
        headers=headers
    )
    assert res1.status_code == 201, res1.text
    rep1 = res1.json()
    print("Report 1 submitted:", rep1["id"], "Status:", rep1["status"], "Zone:", rep1["zone_name"])
    assert rep1["zone_name"] == "RS Puram"

    # Submit second report within 50 meters (11.0098, 76.9478)
    img_bytes2 = create_distinct_image("fresh_fire_2")
    res2 = client.post(
        "/reports",
        data={"lat": "11.0098", "lng": "76.9478"},
        files={"photo": ("fire_unique_2.jpg", img_bytes2, "image/jpeg")},
        headers=headers
    )
    assert res2.status_code == 201, res2.text
    rep2 = res2.json()
    print("Report 2 submitted:", rep2["id"], "Status:", rep2["status"], "Zone:", rep2["zone_name"])

    # Both must now be auto-confirmed by corroboration!
    assert rep2["status"] == "confirmed"
    
    # Check rep1 in database to verify it auto-flipped to confirmed
    get1 = client.get(f"/reports/{rep1['id']}")
    assert get1.json()["status"] == "confirmed"
    print("Corroboration test PASSED! Both reports within 200m auto-confirmed!")

if __name__ == "__main__":
    test_outside_coverage()
    test_corroboration_logic()
    print("\nALL BACKEND FIX TESTS (PART A) PASSED!")
