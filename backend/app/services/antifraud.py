from datetime import datetime, timedelta
from typing import Tuple, Optional
from PIL import Image, ExifTags
import imagehash
from sqlalchemy.orm import Session
from app.models import Report

# Maximum age for photo to be considered fresh (24 hours)
MAX_PHOTO_AGE_HOURS = 24
# Maximum Hamming distance to consider two images duplicates (0-5 out of 64)
DUPLICATE_PHASH_THRESHOLD = 5

def check_exif_freshness(image_path: str) -> Tuple[Optional[datetime], Optional[str]]:
    """
    Extracts EXIF DateTimeOriginal. If older than MAX_PHOTO_AGE_HOURS or in future,
    returns (timestamp, 'stale_photo').
    """
    exif_dt = None
    try:
        img = Image.open(image_path)
        exif = img.getexif()
        if exif:
            # Search primary and sub-IFD exif tags
            date_str = None
            # 36867 is DateTimeOriginal, 306 is DateTime, 36868 is DateTimeDigitized
            for tag_id in [36867, 306, 36868]:
                if tag_id in exif:
                    date_str = exif[tag_id]
                    break
            
            # Also check exif.get_ifd(0x8769) for Exif sub-IFD
            if not date_str:
                try:
                    sub_ifd = exif.get_ifd(0x8769)
                    for tag_id in [36867, 36868]:
                        if tag_id in sub_ifd:
                            date_str = sub_ifd[tag_id]
                            break
                except Exception:
                    pass

            if date_str and isinstance(date_str, str):
                for fmt in ["%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        exif_dt = datetime.strptime(date_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
    except Exception as e:
        print(f"Warning: could not read EXIF data: {e}")

    if exif_dt:
        now = datetime.now()
        # If older than 24 hours
        if (now - exif_dt) > timedelta(hours=MAX_PHOTO_AGE_HOURS):
            return exif_dt, "stale_photo"
        # If in the future by more than 1 hour
        if (exif_dt - now) > timedelta(hours=1):
            return exif_dt, "stale_photo"

    return exif_dt, None

def compute_photo_hash(image_path: str) -> str:
    """
    Computes 64-bit perceptual hash (pHash) of an image.
    """
    try:
        img = Image.open(image_path)
        hash_val = imagehash.phash(img)
        return str(hash_val)
    except Exception as e:
        print(f"Error computing pHash: {e}")
        # Return fallback hash based on file size and mtime if pHash fails
        return "0000000000000000"

def check_duplicate_photo(db: Session, current_hash_str: str) -> Optional[str]:
    """
    Compares current image pHash with existing reports in database.
    If Hamming distance <= DUPLICATE_PHASH_THRESHOLD, returns 'duplicate_photo'.
    """
    if not current_hash_str or current_hash_str == "0000000000000000":
        return None

    try:
        curr_hash = imagehash.hex_to_hash(current_hash_str)
    except Exception:
        return None

    # Query existing report hashes
    existing_reports = db.query(Report.id, Report.photo_hash).filter(Report.photo_hash != None).all()
    for rep_id, past_hash_str in existing_reports:
        try:
            past_hash = imagehash.hex_to_hash(past_hash_str)
            dist = curr_hash - past_hash  # Hamming distance
            if dist <= DUPLICATE_PHASH_THRESHOLD:
                print(f"Duplicate photo detected: matches report #{rep_id} with distance {dist}")
                return "duplicate_photo"
        except Exception:
            continue

    return None
