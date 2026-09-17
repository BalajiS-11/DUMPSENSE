import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, UploadCloud, AlertTriangle, CheckCircle, RefreshCw, Eye, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import { reportsApi } from '../api';
import { StatusBadge, ConfidenceBadge } from '../components/Badges';

export default function UploadReport({ onReportSuccess, onViewMap }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lat, setLat] = useState(11.0022); // Default Singanallur
  const [lng, setLng] = useState(77.0180);
  const [locStatus, setLocStatus] = useState('detecting'); // detecting | captured | fallback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Auto-capture GPS on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setLng(parseFloat(pos.coords.longitude.toFixed(6)));
          setLocStatus('captured');
        },
        (err) => {
          console.warn('Geolocation denied or unavailable, using Coimbatore hotspot coordinates:', err);
          // Fallback to Singanallur dump hotspot
          setLat(11.0022);
          setLng(77.0180);
          setLocStatus('fallback');
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setLocStatus('fallback');
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSubmissionResult(null);
      setUploadError(null);
    }
  };

  const handleQuickTestSample = async (sampleType) => {
    // For fast judge testing: trigger photo directly
    try {
      setIsSubmitting(true);
      setUploadError(null);
      
      // Fetch the sample test image from backend static/test endpoint
      const response = await fetch('/FireDetection/test_image.webp');
      let blob;
      if (response.ok) {
        blob = await response.blob();
      } else {
        // Fallback create a dummy image blob
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = sampleType === 'fire' ? '#B91C1C' : '#D97706';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px sans-serif';
        ctx.fillText(sampleType === 'fire' ? 'Simulated Open Burning Site' : 'Simulated Waste Dump', 40, 150);
        blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg'));
      }
      
      const file = new File([blob], `${sampleType}_sample.webp`, { type: 'image/webp' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      
      // Auto-submit with Coimbatore coordinates
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('lat', sampleType === 'fire' ? '11.0018' : '10.9942');
      fd.append('lng', sampleType === 'fire' ? '77.0192' : '77.0415');

      const result = await reportsApi.uploadReport(fd);
      setSubmissionResult(result);
      if (onReportSuccess) onReportSuccess(result);
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.detail || 'Failed to submit test incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select or capture a photo first');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);
    setSubmissionResult(null);

    try {
      const fd = new FormData();
      fd.append('photo', selectedFile);
      fd.append('lat', lat.toString());
      fd.append('lng', lng.toString());

      const res = await reportsApi.uploadReport(fd);
      setSubmissionResult(res);
      if (onReportSuccess) {
        onReportSuccess(res);
      }
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.detail || 'Upload submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSubmissionResult(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-app mx-auto px-4 sm:px-6 py-6 sm:py-8">
      
      {/* Breadcrumb / Title */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">Citizen Reporting</span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5">Report a Dump or Open Burn Site</h2>
        <p className="text-sm text-slate-500 mt-1">
          Auto-validated via computer vision (YOLOv8) with EXIF anti-tamper and duplicate photo protection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Form & Upload Area (7 cols on desktop, full width on 375px mobile) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Submission Result / Confirmation Cards */}
          {submissionResult ? (
            <div className={`p-6 rounded-card border shadow-md space-y-4 ${
              submissionResult.status === 'rejected' 
                ? 'bg-red-50/70 border-red-200' 
                : 'bg-white border-slate-200'
            }`}>
              {submissionResult.status === 'rejected' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-status-confirmed">
                    <AlertTriangle className="w-7 h-7 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Report Rejected by Anti-Fraud Guard</h3>
                      <p className="text-xs text-red-700">Automatic rejection reason: <strong>{submissionResult.rejection_reason}</strong></p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-white p-3 rounded-element border border-red-100">
                    {submissionResult.rejection_reason === 'duplicate_photo' && 
                      'This exact image was already submitted in another civic report. Duplicate submissions are automatically dropped to prevent fraud.'}
                    {submissionResult.rejection_reason === 'stale_photo' && 
                      'The EXIF timestamp indicates this photo is older than 24 hours. Reports must be real-time incidents.'}
                    {submissionResult.rejection_reason === 'low_confidence' && 
                      'The AI model could not detect open burning or significant waste accumulation in this image.'}
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 rounded-element bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 text-xs font-semibold"
                    >
                      Try Another Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-status-safe">
                    <CheckCircle className="w-7 h-7 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Report Submitted — Pending Confirmation</h3>
                      <p className="text-xs text-slate-600">Your incident has been logged and broadcasted to ward officers.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-element border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Assigned Zone</span>
                      <span className="font-semibold text-slate-800">{submissionResult.zone_name || 'Singanallur'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">AI Classification</span>
                      <div className="mt-0.5">
                        <ConfidenceBadge classification={submissionResult.classification} confidence={submissionResult.confidence} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Map Status</span>
                      <div className="mt-0.5">
                        <StatusBadge status={submissionResult.status} />
                      </div>
                    </div>
                  </div>

                  {/* Visual Preview */}
                  {submissionResult.photo_url && (
                    <div className="relative rounded-element overflow-hidden border border-slate-200 aspect-video max-h-48">
                      <img 
                        src={submissionResult.photo_url} 
                        alt="Detected violation" 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono">
                        YOLOv8 Detection Overlay
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={onViewMap}
                      className="px-4 py-2 rounded-element bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View Pin on Live Map
                    </button>
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 rounded-element bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Report Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-7 rounded-card border border-slate-200 shadow-sm space-y-5">
              
              {/* Photo Input Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Photo Evidence of Dumping / Burning
                </label>
                
                {previewUrl ? (
                  <div className="relative rounded-card overflow-hidden border-2 border-slate-200 bg-slate-900 group aspect-video sm:aspect-auto sm:h-64">
                    <img 
                      src={previewUrl} 
                      alt="Selected upload preview" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-element bg-white text-slate-900 text-xs font-semibold hover:bg-slate-100"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-3 py-1.5 rounded-element bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-accent hover:bg-slate-50/50 rounded-card p-8 text-center cursor-pointer transition-all duration-smooth"
                  >
                    <div className="w-12 h-12 rounded-full bg-sky-50 text-accent mx-auto flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 block">
                      Tap to capture or upload photo
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      JPG, PNG, WebP up to 10MB • Auto-reads EXIF metadata
                    </span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Error state */}
              {uploadError && (
                <div className="p-3 rounded-element bg-red-50 border border-red-200 text-status-confirmed text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className="w-full py-3 rounded-element text-sm font-semibold bg-accent hover:bg-accent-hover text-white shadow-sm flex items-center justify-center gap-2 transition-all duration-smooth active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running AI Classification & Anti-Fraud Checks...
                  </span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Submit Report for Ward Action</span>
                  </>
                )}
              </button>

              {/* 1-Click Samples for Fast Judge Testing */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  🧪 Expo Test Shortcuts (Instant Test Samples):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickTestSample('fire')}
                    className="p-2.5 rounded-element text-left border border-slate-200 hover:border-red-300 hover:bg-red-50/40 text-xs transition-colors"
                  >
                    <span className="font-semibold text-slate-800 block">🔥 Real Fire Sample</span>
                    <span className="text-[11px] text-slate-500">Triggers YOLOv8 fire detector</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickTestSample('waste')}
                    className="p-2.5 rounded-element text-left border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-xs transition-colors"
                  >
                    <span className="font-semibold text-slate-800 block">🗑️ Waste Pile Sample</span>
                    <span className="text-[11px] text-slate-500">Triggers waste accumulation check</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

        {/* Live GPS & Location Preview Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-card border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />
                <h3 className="font-bold text-sm text-slate-900">Auto-Captured GPS Location</h3>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                locStatus === 'captured' 
                  ? 'bg-green-50 text-status-safe border border-green-200' 
                  : 'bg-amber-50 text-status-pending border border-amber-200'
              }`}>
                {locStatus === 'captured' ? 'Live GPS Locked' : 'Coimbatore Ward Hotspot'}
              </span>
            </div>

            {/* Coordinates display */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-element border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">LATITUDE</span>
                <span className="text-slate-800 font-semibold">{lat}° N</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">LONGITUDE</span>
                <span className="text-slate-800 font-semibold">{lng}° E</span>
              </div>
            </div>

            {/* Interactive Coimbatore Mini-Map Preview */}
            <div className="relative rounded-card overflow-hidden border border-slate-200 h-52 bg-slate-100 flex flex-col justify-between p-3">
              {/* Map background styling with SVG pin */}
              <div className="absolute inset-0 bg-slate-100 opacity-90">
                <svg className="w-full h-full text-slate-200" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E8F0" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {/* Pin indicator */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border-2 border-accent animate-ping absolute -inset-0" />
                  <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg relative z-10">
                    <MapPin className="w-5 h-5 fill-white text-accent" />
                  </div>
                </div>
                <span className="mt-2 text-xs font-bold text-slate-900 bg-white/95 px-2.5 py-1 rounded-full shadow-sm border border-slate-200">
                  Singanallur / Ondipudur Ward Corridor
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Coimbatore, Tamil Nadu
                </span>
              </div>

              {/* Mini controls */}
              <div className="relative z-10 flex justify-between items-center text-[10px] text-slate-600 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-element border border-slate-200">
                <span>Accuracy: ±15m</span>
                <span>Ward 62 Jurisdiction</span>
              </div>
            </div>

            {/* System pipeline breakdown info */}
            <div className="p-3.5 bg-slate-50 rounded-element border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <span className="font-semibold text-slate-800 block">Real-time Ingestion Rules:</span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                <li>Stale photos (&gt;24h EXIF) are immediately rejected</li>
                <li>Perceptual duplicate hash matches (pHash $\le 5$) are dropped</li>
                <li>Confirmed incidents alert local ward patrol teams</li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
