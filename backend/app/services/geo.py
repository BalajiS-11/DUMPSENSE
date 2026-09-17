import json
import math
from typing import Optional, Tuple
from shapely.geometry import shape, Point
from sqlalchemy.orm import Session
from app.models import Zone

# Maximum coverage radius from any Coimbatore municipal zone boundary (15 km)
MAX_COVERAGE_DISTANCE_KM = 15.0

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two GPS points in kilometers.
    """
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_matching_zone(db: Session, lat: float, lng: float) -> Tuple[Optional[int], str]:
    """
    Finds the municipal zone for given lat, lng using Point-in-Polygon check.
    If point is outside all zone polygons, finds the nearest zone.
    If distance to the nearest zone exceeds MAX_COVERAGE_DISTANCE_KM (15 km),
    returns (None, 'Outside Coverage Area') instead of falsely labeling the report.
    """
    pt = Point(lng, lat)  # Shapely takes (x=lng, y=lat)
    zones = db.query(Zone).all()

    if not zones:
        return None, "Outside Coverage Area"

    # 1. Exact Point-in-Polygon
    for z in zones:
        if z.boundary:
            try:
                poly_geo = json.loads(z.boundary)
                poly = shape(poly_geo)
                if poly.contains(pt):
                    return z.id, z.name
            except Exception as e:
                print(f"Error parsing boundary for zone {z.name}: {e}")

    # 2. Find closest zone and calculate actual distance in km
    closest_zone = None
    min_distance_km = float("inf")

    for z in zones:
        if z.boundary:
            try:
                poly_geo = json.loads(z.boundary)
                poly = shape(poly_geo)
                # Compute distance between report point and polygon centroid
                centroid = poly.centroid
                dist_km = haversine_distance_km(lat, lng, centroid.y, centroid.x)

                # Check if closer to any polygon vertex or edge
                coords = poly_geo.get("coordinates", [[]])[0]
                for c_lng, c_lat in coords:
                    vertex_dist = haversine_distance_km(lat, lng, c_lat, c_lng)
                    if vertex_dist < dist_km:
                        dist_km = vertex_dist

                if dist_km < min_distance_km:
                    min_distance_km = dist_km
                    closest_zone = z
            except Exception as e:
                print(f"Distance calculation error for {z.name}: {e}")

    # 3. Distance check: if distance > 15 km, reject false ward labeling
    if min_distance_km > MAX_COVERAGE_DISTANCE_KM or closest_zone is None:
        print(f"Coordinates ({lat}, {lng}) are {min_distance_km:.2f}km from nearest ward -> Outside Coverage Area")
        return None, "Outside Coverage Area"

    return closest_zone.id, closest_zone.name
