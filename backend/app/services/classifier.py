import os
import uuid
from pathlib import Path
from typing import Dict, Any, List
import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

from app.core.config import settings

# Global model instances
_fire_model = None
_waste_model = None

def _resolve_model_path(primary_path: Path, alt_names: List[str]) -> Path:
    if primary_path.exists():
        return primary_path
    for name in alt_names:
        for prefix in ["MODEL", "../MODEL", "FireDetection", "../FireDetection"]:
            candidate = (Path(prefix) / name).resolve()
            if candidate.exists():
                return candidate
    raise FileNotFoundError(f"Model file not found for {primary_path} or candidate names {alt_names}")

def get_models() -> tuple[YOLO, YOLO]:
    global _fire_model, _waste_model
    if _fire_model is None:
        fire_path = _resolve_model_path(settings.FIRE_MODEL_PATH, ["best.pt"])
        print(f"Loading Fire YOLO model from {fire_path}...")
        _fire_model = YOLO(str(fire_path))
        print(f"Fire model loaded successfully. Classes: {_fire_model.names}")

    if _waste_model is None:
        waste_path = _resolve_model_path(settings.WASTE_MODEL_PATH, ["best2.pt"])
        print(f"Loading Waste YOLO model from {waste_path}...")
        _waste_model = YOLO(str(waste_path))
        print(f"Waste model loaded successfully. Classes: {_waste_model.names}")

    return _fire_model, _waste_model

def get_yolo_model() -> YOLO:
    """Backward-compatible helper returning the primary fire model."""
    fire_model, _ = get_models()
    return fire_model

def classify_image(image_path: str, conf_threshold: float = 0.15) -> Dict[str, Any]:
    """
    Run BOTH YOLOv8 models on every uploaded image:
    1. fire_model (best.pt) -> fire / smoke detection
    2. waste_model (best2.pt) -> waste pile detection

    Decision logic:
    - If fire_model top confidence > waste_model top confidence AND fire_conf > 0.25 -> open_burning
    - If waste_model top confidence > fire_model top confidence AND waste_conf > 0.25 -> waste_pile
    - If both <= 0.25 -> clean, confidence = None, no_detection = True
    """
    fire_model, waste_model = get_models()

    # Run inference on both models
    fire_results = fire_model.predict(source=image_path, conf=conf_threshold, verbose=False)
    waste_results = waste_model.predict(source=image_path, conf=conf_threshold, verbose=False)

    # Extract top detection from fire model
    fire_top_conf = 0.0
    fire_boxes: List[Dict[str, Any]] = []
    if len(fire_results) > 0 and fire_results[0].boxes is not None and len(fire_results[0].boxes) > 0:
        for box in fire_results[0].boxes:
            cls_id = int(box.cls[0].item())
            cls_name = fire_model.names.get(cls_id, str(cls_id))
            conf = float(box.conf[0].item())
            xyxy = [float(x.item()) for x in box.xyxy[0]]
            if conf > fire_top_conf:
                fire_top_conf = conf
            fire_boxes.append({
                "box": xyxy,
                "label": cls_name,
                "confidence": round(conf, 4)
            })

    # Extract top detection from waste model
    waste_top_conf = 0.0
    waste_boxes: List[Dict[str, Any]] = []
    if len(waste_results) > 0 and waste_results[0].boxes is not None and len(waste_results[0].boxes) > 0:
        for box in waste_results[0].boxes:
            cls_id = int(box.cls[0].item())
            cls_name = waste_model.names.get(cls_id, str(cls_id))
            conf = float(box.conf[0].item())
            xyxy = [float(x.item()) for x in box.xyxy[0]]
            if conf > waste_top_conf:
                waste_top_conf = conf
            waste_boxes.append({
                "box": xyxy,
                "label": cls_name,
                "confidence": round(conf, 4)
            })

    annotated_filename = f"annotated_{uuid.uuid4().hex[:12]}.jpg"
    annotated_save_path = settings.UPLOAD_DIR / annotated_filename

    # Decision logic based on Part 1 specifications
    if fire_top_conf > waste_top_conf and fire_top_conf > 0.25:
        classification = "open_burning"
        confidence = round(fire_top_conf, 4)
        no_detection = False
        detections = fire_boxes
        winning_model_name = "fire_model (best.pt)"
        res_plotted = fire_results[0].plot()
        cv2.imwrite(str(annotated_save_path), res_plotted)
    elif waste_top_conf > fire_top_conf and waste_top_conf > 0.25:
        classification = "waste_pile"
        confidence = round(waste_top_conf, 4)
        no_detection = False
        detections = waste_boxes
        winning_model_name = "waste_model (best2.pt)"
        res_plotted = waste_results[0].plot()
        cv2.imwrite(str(annotated_save_path), res_plotted)
    else:
        classification = "clean"
        confidence = None
        no_detection = True
        detections = []
        winning_model_name = "none (both below 0.25)"
        img = cv2.imread(image_path)
        if img is not None:
            cv2.imwrite(str(annotated_save_path), img)

    # Print winning model to console for testing verification
    print(f"[Classifier] Decision: {classification} won by {winning_model_name} (fire_top: {fire_top_conf:.4f}, waste_top: {waste_top_conf:.4f})")

    annotated_url = f"/uploads/{annotated_filename}" if annotated_save_path.exists() else None

    return {
        "classification": classification,
        "confidence": confidence,
        "no_detection": no_detection,
        "detections": detections,
        "annotated_url": annotated_url
    }
