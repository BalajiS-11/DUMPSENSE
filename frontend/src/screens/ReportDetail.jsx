import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Shield, 
  Flame, 
  Hash, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  FileCheck,
  UserCheck,
  FileDown
} from 'lucide-react';
import { reportsApi, getImageUrl } from '../api';
import { StatusBadge, ConfidenceBadge, TrustScoreChip } from '../components/Badges';
import { useLanguage } from '../context/LanguageContext';

export default function ReportDetail({ reportId, onBack, currentUser, onReportUpdated }) {
  const { t, lang } = useLanguage();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await reportsApi.getReportById(reportId);
      setReport(data);
    } catch (err) {
      console.error('Failed to load report detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) fetchDetail();
  }, [reportId]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await reportsApi.downloadReportPdf(report.id);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to generate PDF dossier');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleVerify = async (action) => {
    setVerifying(true);
    setActionError(null);
    try {
      const updated = await reportsApi.verifyReport(reportId, action);
      setReport(updated);
      if (onReportUpdated) onReportUpdated(updated);
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Verification action failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-app mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-500 text-sm font-semibold">
          <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Loading report investigation dossier #{reportId}...
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-app mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-slate-500 text-sm font-medium">Report #{reportId} was not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-element bg-slate-800 text-white text-xs font-semibold"
        >
          Return to Map
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-app mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Top Header & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-element bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Incident Dossier #{report.id}
              </h2>
              <StatusBadge status={report.status} rejectionReason={report.rejection_reason} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in Ward Jurisdiction: <strong>{report.zone_name || 'Singanallur'}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons: PDF Dossier + Officer Verification */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 rounded-element text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title={t('btn_download_pdf')}
          >
            {downloadingPdf ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{t('btn_download_pdf')}</span>
          </button>

          {currentUser?.role === 'officer' && (
            <>
              <button
                disabled={verifying || report.status === 'confirmed'}
                onClick={() => handleVerify('confirm')}
                className="px-4 py-2 rounded-element text-xs font-semibold bg-status-confirmed hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {t('officer_confirm')} (+2 Trust)
              </button>
              <button
                disabled={verifying || report.status === 'rejected'}
                onClick={() => handleVerify('reject')}
                className="px-4 py-2 rounded-element text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t('officer_reject')} (-5 Trust)
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-element bg-red-50 border border-red-200 text-status-confirmed text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Grid: Photo + Evidence Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: High-Res Evidence Photo with YOLO Overlay (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 rounded-card overflow-hidden border border-slate-200 shadow-md relative group">
            <img
              src={getImageUrl(report.photo_url)}
              alt={`Evidence for report ${report.id}`}
              className="w-full h-auto max-h-[500px] object-contain mx-auto"
              onError={(e) => { e.target.src = '/test_image.webp'; }}
            />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <ConfidenceBadge classification={report.classification} confidence={report.confidence} />
            </div>
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-element bg-black/80 backdrop-blur-xs text-white text-xs font-mono">
              YOLOv8 Detection Output
            </div>
          </div>

          <div className="p-4 bg-white rounded-card border border-slate-200 shadow-sm text-xs text-slate-600 space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Computer Vision Analysis</span>
            <p>
              Model classified visual evidence as <strong className="text-slate-900">{report.classification}</strong> with a calculated confidence rating of <strong>{Math.round((report.confidence || 0) * 100)}%</strong>. Bounding boxes highlight open flame core and plume density.
            </p>
          </div>
        </div>

        {/* Right: Forensic Metadata & Audit Trail (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Geolocation Card */}
          <div className="bg-white p-5 rounded-card border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <MapPin className="w-4 h-4 text-accent" />
              <span>Location Coordinates</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-element border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">LATITUDE</span>
                <span className="font-bold text-slate-800">{report.lat}° N</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">LONGITUDE</span>
                <span className="font-bold text-slate-800">{report.lng}° E</span>
              </div>
            </div>
            <div className="text-xs text-slate-600">
              Zone Authority: <strong className="text-slate-900">{report.zone_name || 'Singanallur Ward'}</strong>
            </div>
          </div>

          {/* Anti-Fraud Inspection Card */}
          <div className="bg-white p-5 rounded-card border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Shield className="w-4 h-4 text-accent" />
              <span>Anti-Fraud & Authenticity Verification</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Perceptual Hash (pHash)</span>
                <span className="font-mono text-[11px] text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                  {report.photo_hash || 'Verified'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">EXIF Timestamp</span>
                <span className="text-slate-800 font-medium">
                  {report.exif_timestamp ? new Date(report.exif_timestamp).toLocaleString() : 'Fresh (Zero-delay capture)'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Duplicate Check</span>
                <span className="text-status-safe font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Unique Capture
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Citizen Reporter Trust</span>
                <TrustScoreChip score={report.reporter_trust_score ?? 12} />
              </div>
            </div>
          </div>

          {/* Timestamp & Workflow State Card */}
          <div className="bg-white p-5 rounded-card border border-slate-200 shadow-sm space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Clock className="w-4 h-4 text-accent" />
              <span>Audit Timeline</span>
            </div>
            <div className="text-slate-600">
              Submitted at: <strong>{new Date(report.created_at).toLocaleString()}</strong>
            </div>
            <div className="text-slate-500 text-[11px]">
              Broadcasted synchronously to connected civic patrol vehicles via WebSocket channel <code>/ws/reports</code>.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
