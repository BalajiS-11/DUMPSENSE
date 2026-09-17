import os
import uuid
from pathlib import Path
from typing import Dict, Any, List
import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

from app.core.config import settings

# Global model instance
_model = None

def get_yolo_model() -> YOLO:
    global _model
    if _model is None:
        model_path = settings.MODEL_PATH
        if not model_path.exists():
            # Fallback path if running from different root
            candidate_paths = [
                Path("MODEL/best.pt").resolve(),
                Path("MODEL/best2.pt").resolve(),
                Path("../MODEL/best.pt").resolve(),
                Path("../MODEL/best2.pt").resolve(),
                Path("FireDetection/best.pt").resolve(),
                Path("../FireDetection/best.pt").resolve(),
            ]
            found = False
            for p in candidate_paths:
                if p.exists():
                    model_path = p
                    found = True
                    break
            if not found:
                raise FileNotFoundError(f"YOLO model file not found at {model_path}")
        print(f"Loading YOLO model from {model_path}...")
        _model = YOLO(str(model_path))
        print(f"YOLO model loaded successfully. Classes: {_model.names}")
    return _model

def classify_image(image_path: str, conf_threshold: float = 0.15) -> Dict[str, Any]:
    """
    Run YOLOv8 inference on image, extract bounding boxes, confidence,
    and map detected classes {0: 'fire', 1: 'smoke'} to Section 5 schema:
    'open_burning' | 'waste_pile' | 'clean'.
    Also saves an annotated preview image.
    """
    model = get_yolo_model()
    results = model.predict(source=image_path, conf=conf_threshold, verbose=False)
    
    detections: List[Dict[str, Any]] = []
    max_conf = 0.0
    detected_classes = set()
    
    annotated_filename = f"annotated_{uuid.uuid4().hex[:12]}.jpg"
    annotated_save_path = settings.UPLOAD_DIR / annotated_filename
    
    if len(results) > 0:
        res = results[0]
        # Save annotated image rendered by Ultralytics
        res_plotted = res.plot()  # BGR numpy array
        cv2.imwrite(str(annotated_save_path), res_plotted)
        
        boxes = res.boxes
        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                cls_id = int(box.cls[0].item())
                cls_name = model.names.get(cls_id, str(cls_id))
                conf = float(box.conf[0].item())
                xyxy = [float(x.item()) for x in box.xyxy[0]]
                
                detected_classes.add(cls_name.lower())
                if conf > max_conf:
                    max_conf = conf
                
                detections.append({
                    "box": xyxy,
                    "label": cls_name,
                    "confidence": round(conf, 4)
                })
    else:
        # Save a copy as annotated if no results
        img = cv2.imread(image_path)
        if img is not None:
            cv2.imwrite(str(annotated_save_path), img)

    # Class mapping according to Section 5
    if "fire" in detected_classes or "smoke" in detected_classes:
        classification = "open_burning"
        final_confidence = round(max_conf, 4)
    elif max_conf > 0:
        classification = "waste_pile"
        final_confidence = round(max_conf, 4)
    else:
        # If no fire or smoke detected, evaluate if waste pile or clean
        # Default to clean or waste_pile based on heuristic or clean state
        classification = "clean"
        final_confidence = 0.85

    annotated_url = f"/uploads/{annotated_filename}" if annotated_save_path.exists() else None

    return {
        "classification": classification,
        "confidence": final_confidence,
        "detections": detections,
        "annotated_url": annotated_url
    }
