from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    print("Health check test passed!")

def test_login_citizen():
    res = client.post("/auth/login", json={
        "email": "citizen@dumpsense.ai",
        "password": "password123"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "citizen"
    print("Citizen login test passed!")

def test_login_officer():
    res = client.post("/auth/login", json={
        "email": "officer@dumpsense.ai",
        "password": "password123"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "officer"
    print("Officer login test passed!")

if __name__ == "__main__":
    test_health()
    test_login_citizen()
    test_login_officer()
    print("ALL PHASE 1 TESTS PASSED SUCCESSFULLY!")
