import io
import os
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models import Report, ReportTimeline, User, Zone

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Dual Model Inference & Clean Case ---")
    from app.services.classifier import classify_image
    test_img = "static/seed_fire_1.jpg"
    res = classify_image(test_img)
    print("Dual model inference on seed_fire_1:", res["classification"], res["confidence"], "no_detection:", res["no_detection"])
    assert res["classification"] in ["open_burning", "waste_pile"]
    assert res["confidence"] is not None
    assert res["confidence"] > 0.25

    print("--- 2. Checking for any hardcoded 0.85 confidence in classifier ---")
    import inspect
    import app.services.classifier as cl_mod
    src = inspect.getsource(cl_mod)
    assert "0.85" not in src, "Error: Hardcoded 0.85 confidence found in classifier.py!"
    print("Zero hardcoded 0.85 verified!")

    print("--- 3. Testing Report Submission with Keywords & Timeline ---")
    with open("static/seed_fire_1.jpg", "rb") as f:
        img_bytes = f.read()

    # Login as citizen
    login_res = client.post("/auth/login", json={"email": "citizen@dumpsense.ai", "password": "password123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Submit report in Singanallur
    rep_payload = {
        "lat": "11.0022",
        "lng": "77.0180",
        "description": "Large toxic dump burning overnight near hospital",
        "citizen_classification": "Open Burning 🔥",
        "estimated_size": "Large (over 5m²)",
        "is_anonymous": "false"
    }
    create_res = client.post(
        "/reports",
        data=rep_payload,
        files={"photo": ("fire_test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        headers=headers
    )
    assert create_res.status_code == 201, f"Create report failed: {create_res.text}"
    rep_data = create_res.json()
    report_id = rep_data["id"]
    print(f"Created report #{report_id}: {rep_data['classification']}, severity_boost={rep_data['severity_boost']}, zone={rep_data['zone_name']}")
    assert rep_data["severity_boost"] == 3, f"Expected boost 3 for multiple keywords, got {rep_data['severity_boost']}"
    assert rep_data["zone_name"] == "Singanallur"

    # Check Timeline entries
    tl_res = client.get(f"/reports/{report_id}/timeline")
    assert tl_res.status_code == 200
    timeline = tl_res.json()
    stages = [t["stage"] for t in timeline]
    print("Timeline stages after submission:", stages)
    assert "submitted" in stages
    assert "ai_verified" in stages

    print("--- 4. Testing Officer Verification & Automated Action Taken Stage ---")
    officer_login = client.post("/auth/login", json={"email": "officer@dumpsense.ai", "password": "password123"})
    assert officer_login.status_code == 200
    officer_token = officer_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    verify_res = client.patch(
        f"/reports/{report_id}/verify",
        json={"action": "confirm"},
        headers=officer_headers
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "confirmed"

    # Verify timeline has officer_reviewed and action_taken
    tl_res2 = client.get(f"/reports/{report_id}/timeline")
    timeline2 = tl_res2.json()
    stages2 = [t["stage"] for t in timeline2]
    print("Timeline stages after officer confirmation:", stages2)
    assert "officer_reviewed" in stages2
    assert "action_taken" in stages2

    print("--- 5. Testing Share Card Endpoint ---")
    sc_res = client.get(f"/reports/{report_id}/share-card")
    assert sc_res.status_code == 200
    sc_data = sc_res.json()
    print("Share Card Data:", sc_data["share_text"])
    assert "Confirmed" in sc_data["share_text"]
    assert "Singanallur" in sc_data["share_text"]

    print("--- 6. Testing Dindigul Coordinates (Outside Coverage Area) ---")
    dindigul_payload = {
        "lat": "10.3673",
        "lng": "77.9803",
        "description": "Outside city limits",
        "citizen_classification": "Waste Pile 🗑️",
        "is_anonymous": "true"
    }
    dindigul_res = client.post(
        "/reports",
        data=dindigul_payload,
        files={"photo": ("dindigul.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        headers=headers
    )
    assert dindigul_res.status_code == 201
    d_data = dindigul_res.json()
    print(f"Dindigul report zone: '{d_data['zone_name']}', anonymous reporter: '{d_data['reporter_name']}'")
    assert d_data["zone_name"] == "Outside Coverage Area"
    assert d_data["reporter_name"] == "Anonymous Citizen"

    print("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
