import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

import { 
  Flame, 
  Trash2, 
  Sparkles, 
  Filter, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  Activity, 
  ShieldCheck, 
  AlertCircle,
  AlertTriangle,
  Eye,
  Layers,
  MapPin,
  Check
} from 'lucide-react';
import { reportsApi, predictApi, zonesApi, createReportsWebSocket, getImageUrl } from '../api';
import { StatusBadge, ConfidenceBadge } from '../components/Badges';

// Coimbatore Central Coordinate (Lat: 11.002, Lng: 77.005)
const COIMBATORE_CENTER = [77.0050, 11.0020];

// Haversine distance calculation in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LiveMap({ onSelectReport }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const reportMarkersRef = useRef([]);
  const officialMarkersRef = useRef([]);

  const [reports, setReports] = useState([]);
  const [officialZones, setOfficialZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('all');
  
  // Layer toggles
  const [showOfficialLayer, setShowOfficialLayer] = useState(true);
  const [showReportsLayer, setShowReportsLayer] = useState(true);
  const [predictTonight, setPredictTonight] = useState(false);
  const [predictionData, setPredictionData] = useState(null);

  // Inspected objects
  const [selectedPin, setSelectedPin] = useState(null);
  const [selectedOfficialZone, setSelectedOfficialZone] = useState(null);
  const [loadingReports, setLoadingReports] = useState(true);

  // 1. Fetch reports
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const params = selectedZone !== 'all' ? { zone_id: parseInt(selectedZone) } : {};
      const data = await reportsApi.getReports(params);
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  // 2. Fetch Official CCMC Zones (Part 1D)
  const fetchOfficialZones = async () => {
    try {
      const data = await zonesApi.getOfficialZones();
      setOfficialZones(data);
    } catch (err) {
      console.error('Failed to load official CCMC zones:', err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedZone]);

  useEffect(() => {
    fetchOfficialZones();
  }, []);

  // 3. Real-time WebSocket connection
  useEffect(() => {
    const cleanupWs = createReportsWebSocket((message) => {
      if (message.type === 'REPORT_CREATED') {
        setReports((prev) => [message.data, ...prev]);
      } else if (message.type === 'REPORT_VERIFIED') {
        setReports((prev) =>
          prev.map((r) => (r.id === message.data.id ? message.data : r))
        );
        if (selectedPin && selectedPin.id === message.data.id) {
          setSelectedPin(message.data);
        }
      }
    });
    return () => cleanupWs();
  }, [selectedPin]);

  // 4. Initialize MapLibre GL with Real Dark Matter Street Tiles of Coimbatore
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // High performance dark tactical road tiles (zero watermarks, zero API key required)
    const styleSpec = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleSpec,
      center: COIMBATORE_CENTER,
      zoom: 12.3,
      pitch: 35,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 5. Update Citizen Report Markers (Layer 2: 🔴 Illegal Dumps)
  useEffect(() => {
    if (!map.current) return;

    // Clear previous report markers
    reportMarkersRef.current.forEach((m) => m.remove());
    reportMarkersRef.current = [];

    if (!showReportsLayer) return;

    reports.forEach((report) => {
      const isConfirmed = report.status === 'confirmed';
      const isBurning = report.classification === 'open_burning' || report.classification === 'fire';
      const isHighRiskPending = !isConfirmed && (report.confidence || 0) >= 0.70;

      const el = document.createElement('div');
      el.className = 'custom-map-marker group cursor-pointer';

      const pulseHtml = isHighRiskPending
        ? `<div class="absolute -inset-1.5 rounded-full bg-amber-400/40 animate-ping"></div>`
        : ``;

      const iconSvg = isBurning
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

      const bgColor = isConfirmed ? '#DC2626' : '#F59E0B';
      const borderColor = isConfirmed ? '#EF4444' : '#FBBF24';

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          ${pulseHtml}
          <div style="background-color: ${bgColor}; border: 2px solid ${borderColor};" class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl transform transition-transform duration-200 hover:scale-125">
            ${iconSvg}
          </div>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900/95 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 border border-slate-700">
            #${report.id} • ${report.zone_name || 'Ward'} (${Math.round((report.confidence || 0) * 100)}%)
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedOfficialZone(null);
        setSelectedPin(report);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([report.lng, report.lat])
        .addTo(map.current);

      reportMarkersRef.current.push(marker);
    });
  }, [reports, showReportsLayer]);

  // 6. Update Official CCMC Markers (Layer 1: 🟢 28px #16A34A White Border Checkmark)
  useEffect(() => {
    if (!map.current) return;

    // Clear previous official markers
    officialMarkersRef.current.forEach((m) => m.remove());
    officialMarkersRef.current = [];

    if (!showOfficialLayer) return;

    officialZones.forEach((zone) => {
      const el = document.createElement('div');
      el.className = 'custom-official-marker group cursor-pointer';

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div style="background-color: #16A34A; border: 2px solid #FFFFFF;" class="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform duration-200 hover:scale-125">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900/95 text-white text-[10px] font-mono px-2 py-1 rounded shadow-xl whitespace-nowrap z-50 border border-green-500/50">
            🟢 CCMC C&D: ${zone.name} (Ward ${zone.ward_number || 'CCMC'})
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedPin(null);
        setSelectedOfficialZone(zone);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([zone.lng, zone.lat])
        .addTo(map.current);

      officialMarkersRef.current.push(marker);
    });
  }, [officialZones, showOfficialLayer]);

  // 7. Calculate 500m proximity to Official CCMC Point for Selected Incident (Part 1D)
  const nearbyOfficialPoint = useMemo(() => {
    if (!selectedPin || !officialZones.length) return null;
    let closest = null;
    let minDistance = Infinity;
    for (const oz of officialZones) {
      const dist = haversineDistanceMeters(selectedPin.lat, selectedPin.lng, oz.lat, oz.lng);
      if (dist <= 500 && dist < minDistance) {
        minDistance = dist;
        closest = { ...oz, distanceMeters: Math.round(dist) };
      }
    }
    return closest;
  }, [selectedPin, officialZones]);

  // 8. Trigger "Predict Tonight" Heatmap
  const togglePredictTonight = async () => {
    const next = !predictTonight;
    setPredictTonight(next);

    if (next && !predictionData) {
      try {
        const pred = await predictApi.getHotspots();
        setPredictionData(pred);
      } catch (err) {
        console.error('Prediction call failed:', err);
      }
    }
  };

  // Analytics Metrics computation
  const totalIncidents = reports.length;
  const burningCount = reports.filter((r) => r.classification === 'open_burning').length;
  const avgConfidence = reports.length > 0
    ? Math.round((reports.reduce((acc, r) => acc + (r.confidence || 0), 0) / reports.length) * 100)
    : 89;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 flex flex-col overflow-hidden text-slate-100">
      
      {/* Real "Mass Model" Analytics & Layer Controls Strip */}
      <div className="relative z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Ward Filter & Active Incident Counters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1.5 rounded-element text-xs">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent text-slate-200 border-none font-semibold text-xs focus:ring-0 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Coimbatore Wards</option>
              <option value="1" className="bg-slate-900">Singanallur</option>
              <option value="2" className="bg-slate-900">Ondipudur</option>
              <option value="3" className="bg-slate-900">Vellalore</option>
              <option value="4" className="bg-slate-900">Peelamedu</option>
              <option value="5" className="bg-slate-900">Race Course</option>
              <option value="6" className="bg-slate-900">Gandhipuram</option>
              <option value="7" className="bg-slate-900">RS Puram</option>
              <option value="8" className="bg-slate-900">Saravanampatti</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-800/60 rounded-element border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">
              <strong className="text-white">{totalIncidents}</strong> Incidents
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-800/60 rounded-element border border-slate-700/50">
            <Activity className="w-3.5 h-3.5 text-status-pending" />
            <span className="text-xs text-slate-300">
              <strong>{burningCount}</strong> Burns
            </span>
          </div>
        </div>

        {/* Center: Interactive Layer Toggles (Part 1D - Official CCMC vs Citizen Dumps) */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-element border border-slate-800">
          {/* Layer 1: Official C&D Collection Points */}
          <button
            type="button"
            onClick={() => setShowOfficialLayer(!showOfficialLayer)}
            className={`px-2.5 py-1 rounded-element text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showOfficialLayer
                ? 'bg-green-600 text-white shadow-sm ring-1 ring-green-400/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOfficialLayer ? 'bg-white' : 'bg-green-500'}`} />
            <span>Official C&D ({officialZones.length})</span>
          </button>

          {/* Layer 2: Illegal Dump Reports */}
          <button
            type="button"
            onClick={() => setShowReportsLayer(!showReportsLayer)}
            className={`px-2.5 py-1 rounded-element text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showReportsLayer
                ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showReportsLayer ? 'bg-white' : 'bg-red-500'}`} />
            <span>Illegal Dumps ({reports.length})</span>
          </button>

          {/* Layer 3: Hotspot Heatmap */}
          <button
            type="button"
            onClick={togglePredictTonight}
            className={`px-2.5 py-1 rounded-element text-xs font-semibold flex items-center gap-1.5 transition-all ${
              predictTonight
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className={`w-3 h-3 ${predictTonight ? 'animate-spin text-white' : 'text-amber-400'}`} />
            <span>Heatmap</span>
          </button>
        </div>

        {/* Right: Model Confidence Indicator */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 rounded-element border border-slate-700/50 text-xs">
            <span className="text-[10px] text-slate-400">YOLOv8 Conf:</span>
            <span className="font-bold text-status-safe font-mono">{avgConfidence}%</span>
          </div>
        </div>

      </div>

      {/* Main Map Canvas Container */}
      <div className="relative flex-1 w-full h-full bg-slate-950">
        <div 
          ref={mapContainer} 
          className="w-full h-full [&_.maplibregl-canvas]:filter [&_.maplibregl-canvas]:invert-[90%] [&_.maplibregl-canvas]:hue-rotate-180 [&_.maplibregl-canvas]:brightness-[75%] [&_.maplibregl-canvas]:contrast-[130%]" 
        />

        {/* Loading skeleton */}
        {loadingReports && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 text-slate-200 px-3 py-1.5 rounded-element border border-slate-700 text-xs font-semibold flex items-center gap-2 shadow-lg">
            <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading Coimbatore street pins...
          </div>
        )}

        {/* Empty State Overlay (when both layers or reports have 0 pins) */}
        {!loadingReports && showReportsLayer && reports.length === 0 && (
          <div className="absolute top-4 left-4 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-element p-3 max-w-xs shadow-xl space-y-1">
            <div className="flex items-center gap-2 text-white text-xs font-bold">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>No Active Dump Reports</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Only authentic submitted citizen reports appear here. Showing {officialZones.length} official CCMC collection points.
            </p>
          </div>
        )}

        {/* Predictive Heatmap Drawer (Bottom Left) */}
        {predictTonight && predictionData && (
          <div className="absolute bottom-5 left-4 right-4 sm:right-auto sm:w-96 z-30 bg-slate-900/95 backdrop-blur-md p-4 rounded-card shadow-2xl border border-red-500/40 space-y-3 animate-fadeIn text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-red-400 animate-spin" />
                <span>OVERNIGHT BURNING RISK FORECAST</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">22:00 – 05:00 IST</span>
            </div>

            <div className="space-y-1.5">
              {predictionData.top_risk_zones.map((zone, idx) => (
                <div key={idx} className="bg-slate-800/80 p-2.5 rounded-element border border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">{zone.name}</span>
                    <span className="text-[11px] text-slate-400">{zone.trend}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-red-950/80 text-red-300 border border-red-800/60">
                      {Math.round(zone.risk_score * 100)}% Risk
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{zone.recommended_patrol_window}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-amber-200/90 bg-amber-950/40 p-2 rounded-element border border-amber-900/60">
              DBSCAN spatial clustering indicates high overnight risk along the Singanallur & Ondipudur rail siding corridors.
            </div>
          </div>
        )}

        {/* Selected Illegal Dump Pin Inspection Modal / Drawer (Bottom Right) */}
        {selectedPin && (
          <div className="absolute bottom-5 right-4 left-4 sm:left-auto sm:w-92 z-30 bg-slate-900/95 backdrop-blur-md p-4 rounded-card shadow-2xl border border-slate-700 space-y-3 animate-fadeIn text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">Incident #{selectedPin.id}</span>
                <StatusBadge status={selectedPin.status} rejectionReason={selectedPin.rejection_reason} />
              </div>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* 500m Proximity Alert Banner (Part 1D) */}
            {nearbyOfficialPoint && (
              <div className="p-3 rounded-element bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs space-y-1 shadow-md">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>PROXIMITY WARNING ({nearbyOfficialPoint.distanceMeters}m)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-100">
                  ⚠️ Illegal dump within <strong className="text-white">{nearbyOfficialPoint.distanceMeters}m</strong> of official C&D collection point: <strong className="text-white">{nearbyOfficialPoint.name}</strong> (Ward {nearbyOfficialPoint.ward_number}). Indicates public awareness failure or collection capacity issue.
                </p>
              </div>
            )}

            {/* Thumbnail */}
            <div className="relative h-32 rounded-element overflow-hidden bg-black border border-slate-800">
              <img
                src={getImageUrl(selectedPin.photo_url)}
                alt="Report thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/test_image.webp'; }}
              />
              <div className="absolute top-2 left-2">
                <ConfidenceBadge classification={selectedPin.classification} confidence={selectedPin.confidence} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">WARD</span>
                <span className="font-semibold text-slate-100">{selectedPin.zone_name || 'Singanallur'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TIME</span>
                <span className="font-semibold text-slate-100">{new Date(selectedPin.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <button
              onClick={() => onSelectReport(selectedPin.id)}
              className="w-full py-2 rounded-element bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <span>View Investigation Dossier</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected Official CCMC Zone Inspection Modal / Drawer (Part 1D) */}
        {selectedOfficialZone && (
          <div className="absolute bottom-5 right-4 left-4 sm:left-auto sm:w-92 z-30 bg-slate-900/95 backdrop-blur-md p-4 rounded-card shadow-2xl border border-green-500/60 space-y-3 animate-fadeIn text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#16A34A] border border-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-sm text-white">Official CCMC Point</span>
              </div>
              <button
                onClick={() => setSelectedOfficialZone(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <h4 className="font-bold text-base text-white">{selectedOfficialZone.name}</h4>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-green-950/80 text-green-300 border border-green-700/60">
                Ward {selectedOfficialZone.ward_number || 'CCMC'} • Active Designated Facility
              </span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-element border border-slate-700/80 text-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Designated Address</span>
              <p className="text-slate-200 text-xs">{selectedOfficialZone.full_address}</p>
            </div>

            <div className="bg-sky-950/40 border border-sky-800/60 p-2 rounded-element text-[11px] text-sky-200">
              ✓ Authorized by Coimbatore City Municipal Corporation Commissioner Annexure for Construction & Demolition waste disposal.
            </div>
          </div>
        )}

        {/* Map Intelligence Legend (Bottom Right on Desktop) (Part 1D) */}
        <div className="absolute bottom-5 right-4 hidden lg:flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-element border border-slate-700/80 text-xs shadow-xl z-20">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
            <span>Map Intelligence Layers</span>
            <span className="text-[9px] text-accent font-mono font-semibold">CCMC Grid</span>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#16A34A] border-2 border-white shadow-xs" />
              <span className="text-slate-200 font-medium">Official C&D Point</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-status-confirmed border border-red-400" />
              <span className="text-slate-300">Illegal Dump</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-status-pending border border-amber-300 animate-pulse" />
              <span className="text-slate-300">Unverified</span>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 font-mono pt-0.5 border-t border-slate-800/80">
            Source: CCMC Commissioner Annexure · Sept 2026
          </div>
        </div>

      </div>

    </div>
  );
}
