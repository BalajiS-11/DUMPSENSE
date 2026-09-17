from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_pipeline():
    # 1. Login as citizen
    login_res = client.post("/auth/login", json={
        "email": "citizen@dumpsense.ai",
        "password": "password123"
    })
    assert login_res.status_code == 200
    token_data = login_res.json()
    token = token_data["access_token"]
    citizen_headers = {"Authorization": f"Bearer {token}"}
    initial_trust_score = token_data["trust_score"]
    print(f"Citizen logged in. Initial trust score: {initial_trust_score}")

    # 2. Upload a report (Singanallur coordinates)
    test_img_path = Path("FireDetection/test_image.webp")
    if not test_img_path.exists():
        test_img_path = Path("../FireDetection/test_image.webp")

    with open(test_img_path, "rb") as f:
        res = client.post(
            "/reports",
            data={"lat": "11.0022", "lng": "77.0180"},
            files={"photo": ("live_fire.webp", f, "image/webp")},
            headers=citizen_headers
        )
    assert res.status_code == 201, f"Create report failed: {res.text}"
    report_data = res.json()
    print("Report created successfully:", report_data)
    assert report_data["status"] in ["unverified", "confirmed"]
    assert report_data["classification"] == "open_burning"
    assert report_data["zone_name"] == "Singanallur"
    report_id = report_data["id"]

    # 3. Test Anti-Fraud Duplicate Check (upload identical image)
    with open(test_img_path, "rb") as f:
        dup_res = client.post(
            "/reports",
            data={"lat": "11.0025", "lng": "77.0185"},
            files={"photo": ("duplicate_fire.webp", f, "image/webp")},
            headers=citizen_headers
        )
    assert dup_res.status_code == 201, f"Duplicate check failed: {dup_res.text}"
    dup_data = dup_res.json()
    print("Duplicate report response:", dup_data)
    assert dup_data["status"] == "rejected"
    assert dup_data["rejection_reason"] == "duplicate_photo"
    print("Anti-fraud pHash duplicate check verified!")

    # 4. Officer Verification flow
    officer_login = client.post("/auth/login", json={
        "email": "officer@dumpsense.ai",
        "password": "password123"
    })
    assert officer_login.status_code == 200
    officer_token = officer_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # Verify report: Confirm
    verify_res = client.patch(
        f"/reports/{report_id}/verify",
        json={"action": "confirm"},
        headers=officer_headers
    )
    assert verify_res.status_code == 200, f"Verify failed: {verify_res.text}"
    verified_data = verify_res.json()
    assert verified_data["status"] == "confirmed"
    print("Officer confirmation verified! Status changed to 'confirmed'.")

    # Check that citizen trust score increased by +2
    me_res = client.get("/auth/me", headers=citizen_headers)
    assert me_res.status_code == 200
    updated_citizen = me_res.json()
    print(f"Updated citizen trust score: {updated_citizen['trust_score']}")
    assert updated_citizen["trust_score"] == initial_trust_score + 2

    # 5. Test GET /reports with filters
    list_res = client.get("/reports?status=confirmed")
    assert list_res.status_code == 200
    confirmed_reports = list_res.json()
    assert len(confirmed_reports) >= 1
    print(f"Queried confirmed reports count: {len(confirmed_reports)}")

    # 6. Test GET /reports/{id}
    detail_res = client.get(f"/reports/{report_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == report_id

    # 7. Test Phase 6: GET /predict-hotspots
    pred_res = client.get("/predict-hotspots")
    assert pred_res.status_code == 200, f"Predict failed: {pred_res.text}"
    pred_data = pred_res.json()
    print("Prediction response summary:")
    print("Forecast window:", pred_data["forecast_window"])
    print("Top risk zones:", [z["name"] for z in pred_data["top_risk_zones"]])
    print(f"Clusters identified: {len(pred_data['clusters'])}")
    assert len(pred_data["clusters"]) >= 1
    assert len(pred_data["top_risk_zones"]) >= 1

    # 8. Test Phase 5: WebSocket Connection
    with client.websocket_connect("/ws/reports") as ws:
        ws.send_text("ping")
        resp = ws.receive_text()
        assert resp == "pong"
        print("WebSocket live reports connection verified!")

    print("\n=============================================")
    print("ALL BACKEND PHASES (1, 2, 3, 4, 5, 6) PASSED!")
    print("=============================================\n")

if __name__ == "__main__":
    test_full_pipeline()
