import { reportsApi } from '../api';

const DB_NAME = 'dumpsense_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'queued_reports';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 1. Enqueue a new report into IndexedDB
 */
export async function enqueueReport(data) {
  const db = await openDB();
  const id = Date.now();
  const queuedItem = {
    id,
    fileBlob: data.fileBlob,
    lat: data.lat,
    lng: data.lng,
    description: data.description || '',
    estimated_size: data.estimated_size || 'Small Pile',
    citizen_classification: data.citizen_classification || 'Waste Pile',
    is_anonymous: !!data.is_anonymous,
    timestamp: new Date().toISOString(),
    status: 'queued',
    retryCount: 0,
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(queuedItem);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Request background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('dumpsense-upload-queue');
    } catch (e) {
      console.warn('[OfflineQueue] Background sync registration skipped:', e);
    }
  }

  return queuedItem;
}

/**
 * 2. Get all reports with status: 'queued'
 */
export async function getQueuedReports() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const queued = all.filter((r) => r.status === 'queued' || r.status === 'uploading');
      resolve(queued);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 3. Remove a queued report by ID
 */
export async function removeQueuedReport(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 4. Update status of a queued report
 */
export async function updateQueuedReportStatus(id, status, error = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) {
        resolve(null);
        return;
      }
      item.status = status;
      if (error) item.lastError = error;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve(item);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * 5. Get count of queued reports
 */
export async function getQueueCount() {
  const reports = await getQueuedReports();
  return reports.length;
}

/**
 * 6. Drain the queue by attempting upload of all queued items
 */
export async function drainQueue(onProgress) {
  if (!navigator.onLine) {
    console.log('[OfflineQueue] Device is offline. Postponing queue drain.');
    return { successCount: 0, failCount: 0 };
  }

  const reports = await getQueuedReports();
  if (reports.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    await updateQueuedReportStatus(report.id, 'uploading');

    try {
      const formData = new FormData();
      // Handle fileBlob (Blob or File)
      const filename = report.fileBlob?.name || `offline_capture_${report.id}.jpg`;
      formData.append('photo', report.fileBlob, filename);
      formData.append('lat', report.lat);
      formData.append('lng', report.lng);
      if (report.description) formData.append('description', report.description);
      if (report.estimated_size) formData.append('estimated_size', report.estimated_size);
      if (report.citizen_classification) formData.append('citizen_classification', report.citizen_classification);
      if (report.is_anonymous !== undefined) formData.append('is_anonymous', report.is_anonymous.toString());

      const res = await reportsApi.uploadReport(formData);
      await removeQueuedReport(report.id);
      successCount++;

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: reports.length,
          success: true,
          reportId: res.id,
          localId: report.id,
        });
      }
    } catch (err) {
      console.error(`[OfflineQueue] Failed to upload queued report #${report.id}:`, err);
      failCount++;
      const nextRetry = (report.retryCount || 0) + 1;
      if (nextRetry >= 3) {
        await updateQueuedReportStatus(report.id, 'failed', err.message || 'Exceeded retry limit');
      } else {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        report.retryCount = nextRetry;
        report.status = 'queued';
        store.put(report);
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: reports.length,
          success: false,
          error: err.message,
          localId: report.id,
        });
      }
    }
  }

  return { successCount, failCount };
}

/**
 * 7. Network connectivity listeners
 */
export function listenToNetworkChanges(onOnline, onOffline) {
  const handleOnline = () => {
    if (onOnline) onOnline();
  };
  const handleOffline = () => {
    if (onOffline) onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial call if caller wants immediate state
  if (!navigator.onLine && onOffline) {
    onOffline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
