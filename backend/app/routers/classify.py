import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.config import settings
from app.schemas import ClassifyResult
from app.services.classifier import classify_image

router = APIRouter(tags=["Classification"])

@router.post("/classify", response_model=ClassifyResult)
async def classify_uploaded_image(file: UploadFile = File(...)):
    """
    Run YOLOv8 model on an uploaded image, returning classification, confidence,
    bounding boxes, and an annotated preview URL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be an image"
        )
    
    # Save uploaded file temporarily
    file_ext = Path(file.filename).suffix or ".jpg"
    temp_filename = f"classify_{uuid.uuid4().hex[:12]}{file_ext}"
    temp_filepath = settings.UPLOAD_DIR / temp_filename
    
    try:
        contents = await file.read()
        with open(temp_filepath, "wb") as f:
            f.write(contents)
            
        result = classify_image(str(temp_filepath))
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}"
        )
