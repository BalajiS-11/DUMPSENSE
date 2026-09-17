import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Filter, 
  Check, 
  X, 
  Clock, 
  Eye, 
  Flame, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Layers,
  Inbox
} from 'lucide-react';
import { reportsApi, getImageUrl } from '../api';
import { StatusBadge, ConfidenceBadge, TrustScoreChip } from '../components/Badges';
import LiveMap from './LiveMap';

export default function OfficerDashboard({ onSelectReport }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [groupByZone, setGroupByZone] = useState(true);
  const [expandedZones, setExpandedZones] = useState({});

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterZone !== 'all') params.zone_id = parseInt(filterZone);
      const data = await reportsApi.getReports(params);
      setReports(data);

      // Default expand all zones
      const zonesMap = {};
      data.forEach((r) => {
        const z = r.zone_name || 'Outside Coverage Area';
        zonesMap[z] = true;
      });
      setExpandedZones(zonesMap);
    } catch (err) {
      console.error('Failed to load dashboard reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus, filterZone]);

  const handleVerify = async (reportId, action) => {
    setActionLoadingId(reportId);
    try {
      const updated = await reportsApi.verifyReport(reportId, action);
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setToastMessage({
        type: action === 'confirm' ? 'success' : 'info',
        text: action === 'confirm' 
          ? `Report #${reportId} confirmed (+2 Citizen Trust applied)` 
          : `Report #${reportId} rejected (-5 Citizen Trust applied)`
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Action failed:', err);
      setToastMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update report status'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleZoneExpand = (zoneName) => {
    setExpandedZones((prev) => ({
      ...prev,
      [zoneName]: !prev[zoneName],
    }));
  };

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toString().includes(q) ||
      (r.zone_name && r.zone_name.toLowerCase().includes(q)) ||
      (r.classification && r.classification.toLowerCase().includes(q))
    );
  });

  // Group reports by Zone
  const groupedByZone = filteredReports.reduce((acc, report) => {
    const zone = report.zone_name || 'Outside Coverage Area';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(report);
    return acc;
  }, {});

  return (
    <div className="max-w-app mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 text-accent text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-accent" />
            Ward Officer Dispatch & Verification
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">Incident Verification Table</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Review incoming citizen reports, verify AI detections, and calibrate citizen trust scores.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Grouping Toggle */}
          <button
            onClick={() => setGroupByZone(!groupByZone)}
            className={`px-3 py-2 rounded-element text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              groupByZone ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{groupByZone ? 'Grouped by Ward' : 'Flat List'}</span>
          </button>

          {/* Refresh Feed */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3.5 py-2 rounded-element bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-3 rounded-card text-xs font-semibold flex items-center gap-2 shadow-xl border animate-fadeIn transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-red-50 text-status-confirmed border-red-200' 
            : toastMessage.type === 'error'
            ? 'bg-red-50 text-status-confirmed border-red-200'
            : 'bg-slate-900 text-white border-slate-800'
        }`}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Live Geospatial Surveillance Map (Part 2D: full map strictly for officers) */}
      <div className="bg-slate-900 rounded-card overflow-hidden border border-slate-700/80 shadow-xl">
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-white tracking-wide uppercase">Coimbatore Tactical Surveillance Map</span>
          </div>
          <span className="text-[11px] text-slate-400">Live WebSockets Feed • Citywide</span>
        </div>
        <div className="h-[460px] sm:h-[500px] w-full relative">
          <LiveMap onSelectReport={onSelectReport} />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-card border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by report ID, ward name, classification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-element border border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-element border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="unverified">Pending Review</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-element border border-slate-200 text-xs">
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 cursor-pointer"
            >
              <option value="all">All Wards</option>
              <option value="1">Singanallur</option>
              <option value="2">Ondipudur</option>
              <option value="3">Vellalore</option>
              <option value="4">Peelamedu</option>
              <option value="5">Race Course</option>
              <option value="6">Gandhipuram</option>
              <option value="7">RS Puram</option>
              <option value="8">Saravanampatti</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Reports Table / Grouped Sections */}
      {loading ? (
        <div className="bg-white p-8 rounded-card border border-slate-200 shadow-sm space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-14 h-12 bg-slate-200 rounded-element" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 bg-slate-200 rounded" />
                <div className="w-1/2 h-3 bg-slate-100 rounded" />
              </div>
              <div className="w-24 h-8 bg-slate-200 rounded-element" />
            </div>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white p-12 text-center space-y-3 rounded-card border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-800">No Reports Found</h3>
          <p className="text-xs text-slate-500">
            There are currently no reports matching your active ward or status filter.
          </p>
        </div>
      ) : groupByZone ? (
        /* Grouped by Ward View */
        <div className="space-y-4">
          {Object.entries(groupedByZone).map(([zoneName, zoneReports]) => {
            const isExpanded = expandedZones[zoneName] !== false;
            const confirmedInZone = zoneReports.filter((r) => r.status === 'confirmed').length;
            const pendingInZone = zoneReports.filter((r) => r.status === 'unverified').length;

            return (
              <div key={zoneName} className="bg-white rounded-card border border-slate-200 shadow-sm overflow-hidden">
                {/* Zone Header Bar */}
                <div
                  onClick={() => toggleZoneExpand(zoneName)}
                  className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors border-b border-slate-200 select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="font-extrabold text-sm text-slate-900">{zoneName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                      {zoneReports.length} {zoneReports.length === 1 ? 'incident' : 'incidents'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {confirmedInZone > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                        {confirmedInZone} Confirmed
                      </span>
                    )}
                    {pendingInZone > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {pendingInZone} Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Table for this Zone */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Photo</th>
                          <th className="py-3 px-4">AI Detection</th>
                          <th className="py-3 px-4">Citizen Trust</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Logged At</th>
                          <th className="py-3 px-4 text-right">Verification Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {zoneReports.map((report) => renderReportRow(report))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat List View */
        <div className="bg-white rounded-card border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Photo</th>
                  <th className="py-3.5 px-4">Ward</th>
                  <th className="py-3.5 px-4">AI Detection</th>
                  <th className="py-3.5 px-4">Citizen Trust</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Logged At</th>
                  <th className="py-3.5 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => renderReportRow(report, true))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );

  function renderReportRow(report, showZone = false) {
    const isActionLoading = actionLoadingId === report.id;

    return (
      <tr key={report.id} className="hover:bg-slate-50/80 transition-colors group">
        {/* Photo thumbnail */}
        <td className="py-2.5 px-4">
          <div
            onClick={() => onSelectReport(report.id)}
            className="w-13 h-11 rounded-element overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer group-hover:border-accent transition-colors relative"
          >
            <img
              src={getImageUrl(report.photo_url)}
              alt="Incident thumb"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = '/test_image.webp'; }}
            />
            <span className="absolute bottom-0 right-0 bg-black/75 text-[9px] text-white px-1 font-mono">
              #{report.id}
            </span>
          </div>
        </td>

        {showZone && (
          <td className="py-2.5 px-4">
            <span className="font-bold text-slate-900 block">{report.zone_name || 'Singanallur'}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
            </span>
          </td>
        )}

        {/* AI Detection */}
        <td className="py-2.5 px-4">
          <ConfidenceBadge classification={report.classification} confidence={report.confidence} />
          {report.citizen_classification && (
            <div className="text-[10px] text-slate-500 mt-0.5">
              Citizen: <span className="font-semibold text-slate-700">{report.citizen_classification}</span>
            </div>
          )}
          {report.severity_boost > 0 && (
            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono text-[9px] font-bold">
              ⚡ Boost +{report.severity_boost}
            </span>
          )}
        </td>

        {/* Citizen Trust & Reporter Info */}
        <td className="py-2.5 px-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-800 block">
              {report.reporter_name || 'Citizen'}
            </span>
            <TrustScoreChip score={report.reporter_trust_score ?? 10} />
            {report.estimated_size && (
              <span className="text-[10px] text-slate-500 block">
                Size: {report.estimated_size}
              </span>
            )}
            {report.description && (
              <p className="text-[10px] text-slate-500 italic max-w-xs line-clamp-1">
                "{report.description}"
              </p>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="py-2.5 px-4">
          <StatusBadge status={report.status} rejectionReason={report.rejection_reason} />
        </td>

        {/* Timestamp */}
        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
          {new Date(report.created_at).toLocaleDateString()} {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </td>

        {/* Actions */}
        <td className="py-2.5 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => onSelectReport(report.id)}
              title="Inspect Dossier"
              className="p-1.5 rounded-element bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            <button
              disabled={isActionLoading || report.status === 'confirmed'}
              onClick={() => handleVerify(report.id, 'confirm')}
              title="Confirm Violation (+2 Citizen Trust)"
              className="px-2.5 py-1 rounded-element bg-[#DC2626] hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-30 flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Confirm</span>
            </button>

            <button
              disabled={isActionLoading || report.status === 'rejected'}
              onClick={() => handleVerify(report.id, 'reject')}
              title="Reject Violation (-5 Citizen Trust)"
              className="px-2.5 py-1 rounded-element bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors disabled:opacity-30 flex items-center gap-1 shadow-xs"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
              <span>Reject</span>
            </button>
          </div>
        </td>
      </tr>
    );
  }
}
