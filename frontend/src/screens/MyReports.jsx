import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Circle, 
  Share2, 
  Copy, 
  Check, 
  X, 
  Activity, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Inbox,
  UploadCloud,
  Wifi,
  WifiOff
} from 'lucide-react';
import { reportsApi, getImageUrl } from '../api';
import { StatusBadge, ConfidenceBadge } from '../components/Badges';
import { useLanguage } from '../context/LanguageContext';
import { 
  getQueuedReports, 
  removeQueuedReport, 
  listenToNetworkChanges 
} from '../services/offlineQueue';

export default function MyReports({ currentUser, justSubmittedId, onNavigateReport }) {
  const { t, lang } = useLanguage();
  const [reports, setReports] = useState([]);
  const [queuedReports, setQueuedReports] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [uploadingLocalId, setUploadingLocalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReportForTimeline, setSelectedReportForTimeline] = useState(null);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [highlightId, setHighlightId] = useState(justSubmittedId);

  // Fade out "Just Submitted" badge after 5 seconds
  useEffect(() => {
    if (highlightId) {
      const timer = setTimeout(() => {
        setHighlightId(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightId]);

  const fetchMyReports = async () => {
    try {
      setLoading(true);
      // 1. Fetch offline queued items from IndexedDB
      const queued = await getQueuedReports();
      setQueuedReports(queued);

      // 2. Fetch server reports if online
      if (navigator.onLine) {
        const params = currentUser?.id ? { user_id: currentUser.id } : {};
        const data = await reportsApi.getReports(params);
        setReports(data);
      }
    } catch (err) {
      console.error('Failed to fetch citizen reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReports();

    const cleanup = listenToNetworkChanges(
      () => {
        setIsOnline(true);
        fetchMyReports();
      },
      () => {
        setIsOnline(false);
      }
    );
    return cleanup;
  }, [currentUser]);

  const handleUploadQueued = async (queuedItem) => {
    if (!navigator.onLine) {
      setToastMessage({ type: 'error', text: 'Device is offline. Reconnect to upload this report.' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setUploadingLocalId(queuedItem.id);
    try {
      const fd = new FormData();
      const filename = queuedItem.fileBlob?.name || `offline_capture_${queuedItem.id}.jpg`;
      fd.append('photo', queuedItem.fileBlob, filename);
      fd.append('lat', queuedItem.lat.toString());
      fd.append('lng', queuedItem.lng.toString());
      if (queuedItem.description) fd.append('description', queuedItem.description);
      if (queuedItem.citizen_classification) fd.append('citizen_classification', queuedItem.citizen_classification);
      if (queuedItem.estimated_size) fd.append('estimated_size', queuedItem.estimated_size);
      if (queuedItem.is_anonymous !== undefined) fd.append('is_anonymous', queuedItem.is_anonymous.toString());

      const res = await reportsApi.uploadReport(fd);
      await removeQueuedReport(queuedItem.id);
      setToastMessage({ type: 'success', text: `Report #${res.id} uploaded successfully to municipal grid!` });
      setTimeout(() => setToastMessage(null), 3500);
      await fetchMyReports();
    } catch (err) {
      console.error('Failed to upload queued item:', err);
      setToastMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed. Will retry later.' });
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setUploadingLocalId(null);
    }
  };

  const handleOpenTimeline = async (report) => {
    setSelectedReportForTimeline(report);
    setLoadingTimeline(true);
    try {
      const entries = await reportsApi.getTimeline(report.id);
      setTimelineEntries(entries);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleCloseTimeline = () => {
    setSelectedReportForTimeline(null);
    setTimelineEntries([]);
  };

  const handleShareWhatsApp = async (report) => {
    try {
      const card = await reportsApi.getShareCard(report.id);
      let shareText = card.share_text;
      if (lang === 'ta') {
        const clsName = report.classification === 'waste_pile' ? 'கழிவு குவியல்' : 'திறந்தவெளி எரிப்பு';
        const zone = report.zone_name || 'கோயம்புத்தூர்';
        const conf = report.confidence ? Math.round(report.confidence * 100) : 90;
        shareText = `🚨 ${zone}, கோயம்புத்தூரில் உறுதிப்படுத்தப்பட்ட ${clsName} கண்டறியப்பட்டது (AI துல்லியம்: ${conf}%). DumpSense செயலி மூலம் புகாரளிக்கப்பட்டது. கோவையை தூய்மையாக வைக்க உதவுங்கள் — http://127.0.0.1:5173`;
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const handleCopyShare = async (report) => {
    try {
      const card = await reportsApi.getShareCard(report.id);
      let shareText = card.share_text;
      if (lang === 'ta') {
        const clsName = report.classification === 'waste_pile' ? 'கழிவு குவியல்' : 'திறந்தவெளி எரிப்பு';
        const zone = report.zone_name || 'கோயம்புத்தூர்';
        const conf = report.confidence ? Math.round(report.confidence * 100) : 90;
        shareText = `🚨 ${zone}, கோயம்புத்தூரில் உறுதிப்படுத்தப்பட்ட ${clsName} கண்டறியப்பட்டது (AI துல்லியம்: ${conf}%). DumpSense செயலி மூலம் புகாரளிக்கப்பட்டது.`;
      }
      await navigator.clipboard.writeText(shareText);
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const stagesDef = [
    { key: 'submitted', label: t('timeline_submitted') },
    { key: 'ai_verified', label: t('timeline_ai_verified') },
    { key: 'officer_reviewed', label: t('timeline_officer_reviewed') },
    { key: 'action_taken', label: t('timeline_action_taken') }
  ];

  return (
    <div className="max-w-app mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-card shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">Citizen Portal</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5">{t('my_reports_title')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status tracking for your submitted civic dumping and burning reports.
          </p>
        </div>
        <button
          onClick={onNavigateReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-element bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm transition-all"
        >
          <span>{t('nav_report')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading your reports...</p>
        </div>
      ) : reports.length === 0 && queuedReports.length === 0 ? (
        <div className="bg-white rounded-card border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">{t('my_reports_empty')}</h3>
          <p className="text-xs text-slate-500 mb-6">
            Help Coimbatore authorities monitor unmanaged waste. Report any incident with immediate AI verification.
          </p>
          <button
            onClick={onNavigateReport}
            className="px-5 py-2.5 rounded-element bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm transition-all"
          >
            {t('nav_report')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Queued Offline Reports (Part 2D) */}
          {queuedReports.map((item) => {
            const previewUrl = item.fileBlob ? URL.createObjectURL(item.fileBlob) : '/test_image.webp';
            const isUploading = uploadingLocalId === item.id;

            return (
              <div 
                key={`queued-${item.id}`}
                className="bg-amber-50/70 rounded-card border-2 border-amber-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-element overflow-hidden bg-slate-900 flex-shrink-0 border-2 border-amber-400 relative">
                    <img 
                      src={previewUrl} 
                      alt="Offline evidence" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = '/test_image.webp'; }}
                    />
                    <span className="absolute bottom-0 right-0 bg-amber-600 text-white text-[9px] font-mono px-1 font-bold">
                      LOCAL
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 border border-amber-400 flex items-center gap-1 shadow-xs">
                        <span>⏳ Queued (Offline)</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Lat {item.lat.toFixed(4)}, Lng {item.lng.toFixed(4)}
                      </span>
                      {item.citizen_classification && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-medium">
                          {item.citizen_classification}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-amber-800 font-medium">
                        Saved on device • Will upload when connected
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-600 line-clamp-1 italic max-w-md">
                        "{item.description}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Upload Now Action */}
                <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                  <button
                    type="button"
                    disabled={!isOnline || isUploading}
                    onClick={() => handleUploadQueued(item)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-element text-xs font-bold shadow-xs transition-colors ${
                      !isOnline
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : !isOnline ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>Offline (Saved)</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {reports.map((report) => {
            const isHighlighted = highlightId === report.id;
            const isConfirmed = report.status === 'confirmed';

            return (
              <div 
                key={report.id}
                className={`bg-white rounded-card border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isHighlighted ? 'ring-2 ring-accent border-accent bg-sky-50/20' : 'border-slate-200'
                }`}
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-element overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 relative">
                    <img 
                      src={getImageUrl(report.photo_url)} 
                      alt="Incident evidence" 
                      className="w-full h-full object-cover"
                    />
                    {isHighlighted && (
                      <span className="absolute top-1 left-1 bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        NEW
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-900">#{report.id}</span>
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {report.zone_name || 'Coimbatore'}
                      </span>
                      <StatusBadge status={report.status} />
                      {report.citizen_classification && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                          Citizen: {report.citizen_classification}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <ConfidenceBadge classification={report.classification} confidence={report.confidence} />
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(report.created_at)}
                      </span>
                    </div>

                    {report.description && (
                      <p className="text-xs text-slate-600 line-clamp-1 italic max-w-md">
                        "{report.description}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions (Track Timeline + WhatsApp Share) */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* WhatsApp Share Button (Only if confirmed) */}
                  {isConfirmed && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleShareWhatsApp(report)}
                        title="Share on WhatsApp"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-element bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z"/>
                        </svg>
                        <span className="hidden sm:inline">{t('share_whatsapp')}</span>
                      </button>

                      <button
                        onClick={() => handleCopyShare(report)}
                        title="Copy Share Text"
                        className="p-1.5 rounded-element bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Track Timeline Button */}
                  <button
                    onClick={() => handleOpenTimeline(report)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-element bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5 text-accent" />
                    <span>{t('my_reports_track')}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Modal / Drawer */}
      {selectedReportForTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-card max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                  <Activity className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Incident Timeline #{selectedReportForTimeline.id}</h3>
                  <p className="text-[11px] text-slate-400">{selectedReportForTimeline.zone_name || 'Coimbatore'}</p>
                </div>
              </div>
              <button
                onClick={handleCloseTimeline}
                className="p-1 rounded-element text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Stepper */}
            <div className="p-6 space-y-6">
              {loadingTimeline ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs">Fetching live database timeline...</span>
                </div>
              ) : (
                <div className="relative pl-6 space-y-8">
                  {stagesDef.map((stage, idx) => {
                    // Find if stage exists in real DB entries
                    const entry = timelineEntries.find((e) => e.stage === stage.key);
                    const isCompleted = !!entry;
                    const isLast = idx === stagesDef.length - 1;

                    return (
                      <div key={stage.key} className="relative">
                        {/* Connecting Line */}
                        {!isLast && (
                          <div 
                            className={`absolute -left-4 top-6 bottom-[-2rem] w-0.5 ${
                              isCompleted 
                                ? 'bg-sky-500' 
                                : 'border-l-2 border-dashed border-slate-300'
                            }`}
                          />
                        )}

                        {/* Stage Node Icon */}
                        <div 
                          className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                            isCompleted 
                              ? 'bg-sky-500 text-white' 
                              : 'border-2 border-slate-300 bg-white text-slate-300'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-3 h-3 stroke-[3]" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          )}
                        </div>

                        {/* Stage Content */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                              {stage.label}
                            </span>
                            {isCompleted ? (
                              <span className="text-[11px] font-mono text-slate-500">
                                {formatDate(entry.created_at)}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {t('timeline_pending')}
                              </span>
                            )}
                          </div>

                          {isCompleted && entry.note && (
                            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-element border border-slate-100">
                              {entry.note}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={handleCloseTimeline}
                className="px-4 py-1.5 rounded-element bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
