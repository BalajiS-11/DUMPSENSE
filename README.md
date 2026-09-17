# DumpSense AI

> **Real-Time Open Burning & Waste Dump Detection and Prediction Engine for Coimbatore**

DumpSense is an AI-powered municipal intelligence and citizen-reporting platform designed to tackle illegal waste dumping and unmonitored open trash burning. By combining computer vision (YOLOv8), geospatial analysis, anti-fraud verification (EXIF + perceptual hashing), and spatio-temporal predictive modeling, DumpSense empowers citizens and municipal ward officers to detect, verify, and prevent open burning incidents before they spread.

---

## 🌟 Features

- 📸 **Citizen Reporting**: Fast photo uploads with automatic GPS geolocation capture.
- 🤖 **YOLOv8 AI Classification**: Real-time detection of fire, smoke, and waste piles with instant confidence scores and annotated bounding boxes.
- 🛡️ **Anti-Fraud Engine**: Synchronous EXIF timestamp validation and perceptual hashing (pHash) to reject duplicate/stale imagery automatically.
- 🗺️ **Live Mapbox/MapLibre Map**: Interactive live GIS view of reports categorized by status (`unverified`, `confirmed`, `rejected`) and zone.
- 📈 **Predictive Hotspot Heatmap**: Spatio-temporal clustering and risk analysis to forecast high-risk dump/burn zones over 24–48 hours.
- 👮 **Ward Officer Dashboard**: Review pending citizen submissions, inspect AI confidence & EXIF metrics, confirm or reject incidents, and dynamically update citizen trust scores.
- ⚡ **Real-Time WebSockets**: Live synchronised updates to the map as new reports arrive without refreshing.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Mapbox GL JS / MapLibre GL, Axios, Lucide Icons |
| **Backend** | FastAPI, Uvicorn, SQLAlchemy, Alembic, WebSockets |
| **Database** | SQLite (Default for demo/expo) / PostgreSQL + PostGIS |
| **Computer Vision & ML** | YOLOv8 (Ultralytics), OpenCV, Pillow, ImageHash, scikit-learn |
| **Authentication** | JWT (JSON Web Tokens) with bcrypt password hashing |

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (with virtual environment)
- **Node.js 18+** & **npm**

### 1. One-Click Launch (Windows)

Simply double-click `run_app.bat` or run:
```powershell
.\run_app.ps1
```
This automatically launches both backend (port 8000) and frontend (port 5173), then opens the browser at `http://127.0.0.1:5173`.

---

### 2. Manual Step-by-Step Launch

#### Start the FastAPI Backend
```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
& "..\MODEL\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
```
- **API Base**: `http://127.0.0.1:8000`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`

#### Start the Vite React Frontend
```powershell
cd frontend
npm install
npm run dev
```
- **Web App**: `http://127.0.0.1:5173`

---

### 3. Seed Demo Data (Optional)

To seed Coimbatore municipal zones (Singanallur, Ondipudur, Peelamedu, Vellalore, etc.), baseline reports, and demo accounts:
```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
& "..\MODEL\venv\Scripts\python.exe" app/seed.py
```

#### Demo Logins:
- **Citizen**: `citizen@dumpsense.ai` / `password123`
- **Ward Officer**: `officer@dumpsense.ai` / `password123`

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── core/         # Settings & JWT security
│   │   ├── routers/      # Auth, Reports, Classify, Predict, WebSocket
│   │   ├── services/     # YOLOv8 classifier, Anti-fraud (EXIF/pHash), Geo
│   │   ├── database.py   # SQLAlchemy DB session & engine
│   │   ├── models.py     # Users, Zones, Reports tables
│   │   └── seed.py       # Coimbatore zone & baseline report seeding
│   ├── static/           # Seed images & demo media
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── screens/      # Landing, LiveMap, UploadReport, OfficerDashboard
│   │   ├── components/   # Navbar, Status Badges
│   │   └── api.js        # Axios REST client & WebSocket manager
│   └── package.json
├── MODEL/
│   ├── best.pt           # Trained YOLOv8 Fire & Smoke weights
│   └── detect.py         # Standalone test inference script
├── run_app.bat           # 1-click batch runner
├── run_app.ps1           # 1-click PowerShell runner
└── README.md
```

---

## ⚖️ License
MIT License. Built for the Coimbatore Municipal Project Expo 2026.
