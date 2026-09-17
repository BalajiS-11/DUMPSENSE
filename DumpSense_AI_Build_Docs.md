# DumpSense — Build Documentation Pack (for AI Agent Use)

This single file contains everything Antigravity needs. Feed it section by section — not all at once — using the order in "How to Use This Document" below. All sections use the same table/field names so nothing conflicts.

---

## How to Use This Document (Step by Step)

1. **Paste Section 1 (PRD) + Section 2 (TRD)** into Antigravity first, as context, with the instruction: *"This is the product spec for a project we're building. Read it and confirm you understand before we start."* Don't ask it to build yet.
2. **Paste Section 5 (Backend Schema)** next with: *"Set up a FastAPI + PostgreSQL/PostGIS backend using exactly this schema, with Alembic migrations."*
3. **Paste Section 3 (App Flow)** with: *"Build the API endpoints needed to support these flows."* — reference the endpoint table in Section 2.
4. **Paste Section 4 (UI/UX)** with: *"Build the React frontend screens described here, wired to the endpoints we just built."*
5. **Work through Section 6 (Implementation Plan) one phase at a time** — paste only the current phase's row, not the whole table, so the agent stays focused.
6. After each phase, test manually (Postman/browser) before moving to the next — don't chain phases without checking.

---

## 1. PRD — Product Requirements Document

**Product:** DumpSense
**One-liner:** A citizen-reporting app that uses AI to detect illegal waste dumping/burning in real time and predicts where it's likely to happen next.

**Problem:** Coimbatore generates 1,293 tonnes of waste/day against 1,164 tonnes/day processing capacity. Unmonitored burning happens overnight in Singanallur and Ondipudur with no tracking or accountability.

**Users:**
| User type | What they do |
|---|---|
| Citizen | Uploads a photo of a dump/burn site with auto-captured location |
| Ward Officer | Reviews reports, confirms/rejects, sees the hotspot map |
| Demo viewer (judge) | Watches the live classification + prediction flow |

**Core Features (MoSCoW):**
- **Must have:** photo upload, AI classification (fire/waste detection), live map of reports, EXIF + duplicate-photo anti-fraud checks
- **Should have:** trust-score system, corroboration logic, predictive hotspot heatmap
- **Could have:** officer verification dashboard, Tamil-language UI labels
- **Won't have (for now):** SMS/push notifications, multi-city support, native mobile app (web-responsive only)

**Success Metrics (for the demo):**
- Classify an uploaded photo correctly with a visible confidence score in under 3 seconds
- Reject a stale/duplicate photo automatically without manual review
- Show a predictive heatmap that updates when new reports are added

**Out of Scope:** real citizen data collection, production deployment, payment/auth beyond basic login.

---

## 2. TRD — Technical Requirements Document

**Architecture (text description):**
Citizen/Officer (React frontend) → FastAPI backend → [YOLOv8 model for classification] + [PostgreSQL/PostGIS for storage] + [Anti-fraud checks: EXIF + pHash] → WebSocket broadcasts new reports → Frontend map updates live → Prediction service (DBSCAN + Prophet) reads report history → returns hotspot scores.

**Tech Stack:**
| Layer | Tech |
|---|---|
| Frontend | React (Vite), Tailwind CSS, Mapbox GL JS |
| Backend | FastAPI (Python), WebSockets |
| Database | PostgreSQL + PostGIS |
| ML — Detection | YOLOv8 (Ultralytics), OpenCV |
| ML — Anti-fraud | Pillow/exifread (EXIF), imagehash (pHash) |
| ML — Prediction | scikit-learn (DBSCAN), Prophet/statsmodels |
| Auth | JWT (simple email/password for demo) |
| Dev/Deploy | Docker Compose (local), optional Render/Railway |

**Key API Endpoints:**
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/register, /auth/login | basic user auth |
| POST | /classify | run YOLOv8 on an image, return class + confidence + bbox |
| POST | /reports | upload photo + GPS, runs EXIF/hash/classify, saves report |
| GET | /reports | list reports, filterable by zone/status/date |
| GET | /reports/{id} | single report detail |
| PATCH | /reports/{id}/verify | officer confirms/rejects a report |
| GET | /predict-hotspots | returns risk score per zone for next 24-48h |
| WS | /ws/reports | live feed of new reports |

**Non-Functional Requirements:**
- Must run fully on a single laptop with local Docker (no cloud dependency required for demo)
- Classification response time under 3 seconds
- Must gracefully handle no-internet by falling back to cached map tiles
- Anti-fraud checks (EXIF + hash) run synchronously before a report is marked visible

---

## 3. App Flow

**Citizen Flow:**
1. Open app → tap "Report a Dump/Burn Site"
2. Camera opens or file picker → photo selected
3. App auto-captures GPS via browser geolocation
4. Photo + GPS sent to `POST /reports`
5. Backend runs EXIF check → hash check → `/classify` → saves with status `unverified` or `rejected`
6. Citizen sees confirmation: "Report submitted — pending confirmation" or "Report rejected: [reason]"
7. Pin appears on the live map (pale = unverified)

**Officer Flow:**
1. Officer logs in → sees dashboard table of pending reports
2. Clicks a report → sees photo, classification, confidence, location
3. Confirms or rejects → trust score of reporting user adjusts (+2 / -5)
4. Confirmed reports turn red on the public map

**Prediction Flow:**
1. Officer/demo user clicks "Predict Tonight" on the map
2. Frontend calls `GET /predict-hotspots`
3. Backend clusters recent reports (DBSCAN) → forecasts next 24-48h risk per zone (Prophet)
4. Map renders a heatmap overlay, top zones highlighted

**Background/System Flow (every upload):**
Photo in → EXIF timestamp check → pHash duplicate check → YOLOv8 classification → save to DB with status → broadcast via WebSocket → frontend map updates live.

---

## 4. UI/UX

**Design principles:** modern, clean, minimal — lots of white space, one accent color for alerts, no clutter. Think "civic-tech" not "flashy startup."

**Suggested palette:** dark slate (#1E293B) for headers/nav, white/light-gray (#F8FAFC) backgrounds, red (#DC2626) only for confirmed high-severity pins/alerts, amber (#F59E0B) for unverified/pending, green (#16A34A) for safe/clear zones.

**Typography:** Inter or Poppins, sans-serif, medium weight headers, regular body — avoid decorative fonts.

**Screens:**
| Screen | Key elements |
|---|---|
| Landing/Login | simple logo, one-line tagline, login/register form |
| Upload Report | camera/file input, live GPS preview on a small map, submit button, confirmation state |
| Live Map (main screen) | full-screen Mapbox map, pins colored by status, legend, "Predict Tonight" toggle button, zone filter |
| Report Detail | photo, classification label + confidence badge, GPS, timestamp, status |
| Officer Dashboard | table of reports (sortable by status/date/zone), confirm/reject buttons, trust-score column |
| Predictive Heatmap overlay | toggle on main map, color gradient (green→red) by risk score, small legend |

**Key reusable components:** status badge (unverified/confirmed/rejected), confidence badge (e.g. "91% burning"), trust-score chip, map legend, zone filter dropdown.

**Responsive notes:** Upload screen must work well on a phone (citizens use mobile). Map + officer dashboard can be desktop-optimized for the expo laptop demo.

---

## 5. Backend Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'citizen', -- citizen | officer
    trust_score INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g. Singanallur, Ondipudur, Vellalore
    boundary GEOMETRY(POLYGON, 4326)
);

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    zone_id INT REFERENCES zones(id),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    location GEOMETRY(POINT, 4326),
    photo_url VARCHAR(255) NOT NULL,
    photo_hash VARCHAR(64) NOT NULL,       -- perceptual hash for duplicate check
    exif_timestamp TIMESTAMP,              -- null if missing/stripped
    classification VARCHAR(50),            -- waste_pile | open_burning | clean
    confidence FLOAT,
    status VARCHAR(20) DEFAULT 'unverified', -- unverified | confirmed | rejected
    rejection_reason VARCHAR(100),         -- stale_photo | duplicate_photo | low_confidence
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_reports_location ON reports USING GIST (location);
CREATE INDEX idx_reports_status ON reports (status);
CREATE INDEX idx_reports_created_at ON reports (created_at);
```

---

## 6. Implementation Plan (paste one row at a time to the agent)

| Phase | What to build | Depends on |
|---|---|---|
| 1 | FastAPI project skeleton + PostgreSQL/PostGIS via Docker + schema from Section 5 | none |
| 2 | Wrap trained YOLOv8 model as `POST /classify` returning JSON | trained `best.pt` (already done) |
| 3 | `POST /reports` — full pipeline: EXIF check → hash check → call `/classify` → save | Phase 1 + 2 |
| 4 | `GET /reports`, `GET /reports/{id}`, `PATCH /reports/{id}/verify` + trust-score update logic | Phase 3 |
| 5 | WebSocket `/ws/reports` broadcasting new reports | Phase 3 |
| 6 | `GET /predict-hotspots` — DBSCAN clustering + Prophet forecast | Phase 3 (needs report history) |
| 7 | React frontend: Upload screen + Live Map screen, wired to endpoints | Phase 3, 4, 5 |
| 8 | React frontend: Officer Dashboard + Report Detail screen | Phase 4 |
| 9 | React frontend: Predictive heatmap overlay on map | Phase 6 |
| 10 | End-to-end testing (real + fake/old/duplicate photos) + demo rehearsal | all phases |

**Note:** All sections reference the same field names (`classification`, `confidence`, `status`, `trust_score`, `zone`) — keep this consistency when prompting the agent so nothing breaks between phases.
