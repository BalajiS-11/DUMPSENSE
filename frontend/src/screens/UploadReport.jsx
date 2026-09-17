import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  UploadCloud, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  Eye,
  UserCheck,
  Flame,
  Trash2,
  Check,
  Wifi,
  WifiOff
} from 'lucide-react';
import { reportsApi, getImageUrl } from '../api';
import { StatusBadge, ConfidenceBadge } from '../components/Badges';
import { useLanguage } from '../context/LanguageContext';
import { 
  enqueueReport, 
  getQueueCount, 
  drainQueue, 
  listenToNetworkChanges 
} from '../services/offlineQueue';

export default function UploadReport({ onReportSuccess }) {
  const { t, lang } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lat, setLat] = useState(11.0022); // Default Singanallur
  const [lng, setLng] = useState(77.0180);
  const [locStatus, setLocStatus] = useState('detecting'); // detecting | captured | fallback

  // Offline and Queue State (Part 2C)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);
  const [isDraining, setIsDraining] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [drainNotice, setDrainNotice] = useState(null);

  // Form Fields (Part 7)
  const [description, setDescription] = useState('');
  const [citizenClassification, setCitizenClassification] = useState('');
  const [estimatedSize, setEstimatedSize] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Pre-submit AI Classification Preview (Part 7)
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
          console.warn('Geolocation fallback to Coimbatore hotspot coordinates:', err);
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

  // Check queue count & listen to network changes (Part 2C)
  useEffect(() => {
    const updateQueue = async () => {
      try {
        const count = await getQueueCount();
        setQueueCount(count);
      } catch (e) {
        console.warn('Queue count check failed:', e);
      }
    };

    updateQueue();

    const cleanup = listenToNetworkChanges(
      async () => {
        setIsOnline(true);
        const count = await getQueueCount();
        setQueueCount(count);
        if (count > 0) {
          handleAutoDrain(count);
        }
      },
      () => {
        setIsOnline(false);
      }
    );

    // Background sync notification listener from service worker
    const swHandler = (event) => {
      if (event.data?.type === 'DRAIN_OFFLINE_QUEUE') {
        handleAutoDrain();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', swHandler);
    }

    return () => {
      cleanup();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swHandler);
      }
    };
  }, []);

  const handleAutoDrain = async (knownCount) => {
    const count = knownCount !== undefined ? knownCount : await getQueueCount();
    if (count === 0) return;
    setIsDraining(true);
    setDrainNotice(`Uploading ${count} queued offline ${count === 1 ? 'report' : 'reports'}...`);
    try {
      const { successCount } = await drainQueue();
      const rem = await getQueueCount();
      setQueueCount(rem);
      if (successCount > 0) {
        setDrainNotice(`Successfully uploaded ${successCount} offline reports to Coimbatore municipal grid!`);
        setTimeout(() => setDrainNotice(null), 4000);
      } else {
        setDrainNotice(null);
      }
    } catch (err) {
      console.error('Drain queue error:', err);
      setDrainNotice(null);
    } finally {
      setIsDraining(false);
    }
  };

  // Run AI classification as soon as photo is selected (skip when offline)
  const processImageFile = async (file) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadError(null);
    setAiResult(null);

    if (!navigator.onLine) {
      // In offline mode, skip server AI classification call
      return;
    }

    setIsClassifying(true);
    try {
      const cls = await reportsApi.classify(file);
      setAiResult(cls);
    } catch (err) {
      console.error('Classification error:', err);
      setUploadError('AI model could not process this image format. Please select another.');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleQuickTestSample = async (sampleType) => {
    try {
      if (navigator.onLine) {
        setIsClassifying(true);
      }
      setUploadError(null);
      
      const response = await fetch('/test_image.webp');
      let blob;
      if (response.ok) {
        blob = await response.blob();
      } else {
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
      setCitizenClassification(sampleType === 'fire' ? 'Open Burning 🔥' : 'Waste Pile 🗑️');
      await processImageFile(file);
    } catch (err) {
      console.error(err);
      setUploadError('Failed to load sample image');
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select or capture a photo first');
      return;
    }
    if (!citizenClassification) {
      setUploadError('Please select the waste type observed');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    // Offline flow (Part 2C)
    if (!navigator.onLine) {
      try {
        await enqueueReport({
          fileBlob: selectedFile,
          lat,
          lng,
          description,
          estimated_size: estimatedSize,
          citizen_classification: citizenClassification,
          is_anonymous: isAnonymous,
        });
        setOfflineSaved(true);
        const count = await getQueueCount();
        setQueueCount(count);
        setTimeout(() => {
          if (onReportSuccess) {
            onReportSuccess(null);
          }
        }, 1500);
      } catch (err) {
        console.error('Offline save error:', err);
        setUploadError('Could not save report offline. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Online flow
    try {
      const fd = new FormData();
      fd.append('photo', selectedFile);
      fd.append('lat', lat.toString());
      fd.append('lng', lng.toString());
      if (description) fd.append('description', description);
      fd.append('citizen_classification', citizenClassification);
      if (estimatedSize) fd.append('estimated_size', estimatedSize);
      fd.append('is_anonymous', isAnonymous ? 'true' : 'false');

      const res = await reportsApi.uploadReport(fd);
      if (onReportSuccess) {
        onReportSuccess(res.id);
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
    setAiResult(null);
    setDescription('');
    setCitizenClassification('');
    setEstimatedSize('');
    setIsAnonymous(false);
    setUploadError(null);
    setOfflineSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = selectedFile && 
    (isOnline ? (aiResult && !isClassifying) : true) && 
    citizenClassification && 
    !isSubmitting;

  return (
    <div className="max-w-app mx-auto px-4 sm:px-6 py-6 sm:py-8">
      
      {/* Title */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">Citizen Reporting</span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5">{t('report_title')}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t('report_subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Form Area (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">

          {/* Offline Alert Bar (Part 2C) */}
          {!isOnline && (
            <div className="p-3.5 rounded-card bg-amber-500/15 border-2 border-amber-500 text-amber-900 text-xs flex items-center gap-3 shadow-sm">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
              <div className="flex-1">
                <span className="font-extrabold text-amber-950 block">Offline Mode Active</span>
                <span className="text-amber-900 font-medium">
                  📶 You are offline. Your report and photo will be saved securely and uploaded automatically when connectivity returns.
                </span>
              </div>
            </div>
          )}

          {/* Background Upload Drain Notice */}
          {drainNotice && (
            <div className="p-3 rounded-card bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 shadow-sm animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{drainNotice}</span>
            </div>
          )}

          {/* Online Queue Banner if items waiting */}
          {isOnline && queueCount > 0 && !drainNotice && (
            <div className="p-3 rounded-card bg-sky-50 border border-sky-300 text-sky-900 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span>⏳ <strong>{queueCount}</strong> {queueCount === 1 ? 'report' : 'reports'} saved offline waiting to upload</span>
              </div>
              <button
                type="button"
                disabled={isDraining}
                onClick={() => handleAutoDrain()}
                className="px-3 py-1 rounded-element bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition-colors"
              >
                {isDraining ? 'Uploading...' : 'Upload Now'}
              </button>
            </div>
          )}

          {/* Saved Confirmation Banner */}
          {offlineSaved && (
            <div className="p-3.5 rounded-card bg-green-50 border-2 border-green-400 text-green-900 text-xs flex items-center gap-2.5 shadow-sm animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="font-semibold text-xs leading-relaxed">
                Report saved offline! It will upload automatically when you reconnect.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-7 rounded-card border border-slate-200 shadow-sm space-y-5">
            
            {/* Photo Input Area */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                {t('report_upload_label')}
              </label>
              
              {previewUrl ? (
                <div className="relative rounded-card overflow-hidden border-2 border-slate-200 bg-slate-900 group aspect-video sm:aspect-auto sm:h-64">
                  <img 
                    src={previewUrl} 
                    alt="Upload preview" 
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
                    {t('report_upload_hint')}
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

            {/* AI Classification Feedback (Part 7: inline card BEFORE submit button) */}
            {isClassifying && (
              <div className="p-4 rounded-card bg-sky-50 border border-sky-200 text-accent flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block">Running Dual YOLOv8 Detection Engine...</span>
                  <span className="text-slate-600 text-[11px]">Evaluating fire/smoke model and waste pile model in real time</span>
                </div>
              </div>
            )}

            {aiResult && !isClassifying && (
              <div className="p-4 rounded-card border border-slate-200 bg-slate-50 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-slate-900">AI Validation Result (Dual-Model Preview)</span>
                  </div>
                  <ConfidenceBadge classification={aiResult.classification} confidence={aiResult.confidence} />
                </div>

                <div className="flex gap-3 items-center">
                  {aiResult.annotated_url && (
                    <div className="w-20 h-16 rounded-element overflow-hidden bg-black flex-shrink-0 border border-slate-300">
                      <img 
                        src={getImageUrl(aiResult.annotated_url)} 
                        alt="YOLO BBoxes" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <p className="font-medium text-slate-800">
                      Classification: <span className="font-bold uppercase text-accent">{aiResult.classification}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {aiResult.no_detection 
                        ? 'No active fire or large waste pile detected. Photo will be marked unverified for officer review.'
                        : `Confidence score: ${Math.round((aiResult.confidence || 0) * 100)}% with bounding box detection.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Waste Type Selector (Radio / Segmented Control, Required - Part 7) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Waste Type Observed <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Open Burning 🔥', label: 'Open Burning 🔥' },
                  { id: 'Waste Pile 🗑️', label: 'Waste Pile 🗑️' },
                  { id: 'Both', label: 'Both' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setCitizenClassification(type.id)}
                    className={`py-2 px-3 text-xs font-semibold rounded-element border transition-all text-center ${
                      citizenClassification === type.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description Field with Live Counter (max 200 chars - Part 7) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Describe what you see (optional)
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {description.length} / 200
                </span>
              </div>
              <textarea
                maxLength={200}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Toxic burning near Singanallur hospital overnight..."
                className="w-full p-2.5 text-xs rounded-element border border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent resize-none"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Keywords like "hospital", "overnight", "chemical", "school" automatically apply an emergency severity boost.
              </span>
            </div>

            {/* Estimated Size Dropdown (Optional - Part 7) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estimated Size (optional)
              </label>
              <select
                value={estimatedSize}
                onChange={(e) => setEstimatedSize(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-element border border-slate-300 focus:border-accent"
              >
                <option value="">Select size estimation...</option>
                <option value="Small (under 1m²)">Small (under 1m²)</option>
                <option value="Medium (1–5m²)">Medium (1–5m²)</option>
                <option value="Large (over 5m²)">Large (over 5m²)</option>
              </select>
            </div>

            {/* Anonymous Checkbox (Part 7) */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="anon_check"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-accent focus:ring-accent border-slate-300 cursor-pointer"
              />
              <label htmlFor="anon_check" className="text-xs text-slate-700 font-medium cursor-pointer">
                I am anonymous (hide my name on officer dashboard)
              </label>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="p-3 rounded-element bg-red-50 border border-red-200 text-status-confirmed text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Submit Button (Disabled until photo uploaded, classified, and waste type selected - Part 7) */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 rounded-element text-sm font-semibold text-white shadow-sm flex items-center justify-center gap-2 transition-all duration-smooth active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed ${
                !isOnline ? 'bg-amber-600 hover:bg-amber-700' : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : !isOnline ? (
                <>
                  <span>💾 Save Report Offline</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>{t('report_submit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Right Column: GPS Geolocation & Fast Testing Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* GPS Card */}
          <div className="bg-white p-5 rounded-card border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-accent" />
                {t('report_gps_title')}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                locStatus === 'captured' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {locStatus === 'captured' ? t('report_gps_locked') : 'Hotspot Default'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-element text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Latitude</span>
                <span className="font-bold text-slate-800">{lat}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Longitude</span>
                <span className="font-bold text-slate-800">{lng}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              GPS coordinates are verified against Coimbatore Municipal Corporation boundary polygons. Out-of-bounds coords are flagged.
            </p>
          </div>

          {/* Quick Test Demo Samples for Judges */}
          <div className="bg-slate-50 p-4 rounded-card border border-slate-200 space-y-3">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
              ⚡ QUICK SAMPLES (FOR EXPO DEMO)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickTestSample('fire')}
                className="p-2.5 rounded-element bg-white border border-slate-200 text-left hover:bg-slate-100 transition-colors shadow-xs"
              >
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  Fire Sample
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Loads test fire image</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickTestSample('waste')}
                className="p-2.5 rounded-element bg-white border border-slate-200 text-left hover:bg-slate-100 transition-colors shadow-xs"
              >
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                  Waste Sample
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Loads test waste image</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
