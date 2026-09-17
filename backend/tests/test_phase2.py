from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_classify_endpoint():
    test_img_path = Path("FireDetection/test_image.webp")
    if not test_img_path.exists():
        test_img_path = Path("../FireDetection/test_image.webp")
    assert test_img_path.exists(), f"Test image not found at {test_img_path}"

    with open(test_img_path, "rb") as f:
        response = client.post(
            "/classify",
            files={"file": ("test_image.webp", f, "image/webp")}
        )

    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    print("Classify response:", data)
    assert "classification" in data
    assert data["classification"] in ["open_burning", "waste_pile", "clean"]
    assert "confidence" in data
    assert data["confidence"] > 0
    assert "detections" in data
    assert data["annotated_url"] is not None
    print("PHASE 2 CLASSIFICATION TEST PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_classify_endpoint()
