import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getImageUrl = (url) => {
  if (!url) return '/test_image.webp';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dumpsense_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (email, password, role = 'citizen') => {
    const res = await api.post('/auth/register', { email, password, role });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  }
};

export const reportsApi = {
  getReports: async (params = {}) => {
    const res = await api.get('/reports', { params });
    return res.data;
  },
  getReportById: async (id) => {
    const res = await api.get(`/reports/${id}`);
    return res.data;
  },
  uploadReport: async (formData) => {
    const res = await api.post('/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  classify: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/classify', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  verifyReport: async (id, action, rejection_reason = null) => {
    const res = await api.patch(`/reports/${id}/verify`, {
      action,
      rejection_reason,
    });
    return res.data;
  },
  getTimeline: async (id) => {
    const res = await api.get(`/reports/${id}/timeline`);
    return res.data;
  },
  getShareCard: async (id) => {
    const res = await api.get(`/reports/${id}/share-card`);
    return res.data;
  },
  downloadReportPdf: async (id) => {
    const res = await api.get(`/reports/${id}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DumpSense_Enforcement_DS-2026-${String(id).padStart(5, '0')}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

export const predictApi = {
  getHotspots: async () => {
    const res = await api.get('/predict-hotspots');
    return res.data;
  }
};

export const zonesApi = {
  getOfficialZones: async () => {
    const res = await api.get('/zones/official');
    return res.data;
  },
  getAllZones: async () => {
    const res = await api.get('/zones');
    return res.data;
  }
};

export const createReportsWebSocket = (onMessage) => {
  const wsUrl = `${WS_BASE_URL}/ws/reports`;
  let ws = null;
  let retryTimer = null;

  const connect = () => {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to DumpSense live report feed');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.error('[WebSocket] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Connection closed. Retrying in 3s...');
        retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[WebSocket] Warning:', err);
        ws.close();
      };
    } catch (e) {
      console.error('[WebSocket] Setup error:', e);
      retryTimer = setTimeout(connect, 3000);
    }
  };

  connect();

  return () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (ws) ws.close();
  };
};
