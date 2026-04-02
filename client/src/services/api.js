import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socketInstance = null;

export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socketInstance;
};

let onUnauthorizedCallback = null;

class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

const getAccessToken = () => localStorage.getItem('accessToken');
const getRefreshToken = () => localStorage.getItem('refreshToken');

const setTokens = (access, refresh) => {
  localStorage.setItem('accessToken', access);
  if (refresh) localStorage.setItem('refreshToken', refresh);
};

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

let refreshInFlight = null;

const refreshToken = () => {
  if (refreshInFlight) return refreshInFlight;
  const rt = getRefreshToken();
  if (!rt) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt })
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.data?.accessToken || !data.data?.refreshToken) return false;
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const shouldRetryWithRefresh = (path, status) =>
  status === 401 &&
  !!getRefreshToken() &&
  !path.startsWith('/auth/');

const request = async (path, options = {}) => {
  const { skipAuth, ...fetchOptions } = options;
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
  const token = getAccessToken();
  if (token && !skipAuth) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, headers });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  if (shouldRetryWithRefresh(path, res.status)) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${getAccessToken()}` };
      try {
        res = await fetch(url, { ...fetchOptions, headers: retryHeaders });
      } catch (err) {
        throw new Error(`Network error: ${err.message}`);
      }
    } else {
      clearTokens();
      onUnauthorizedCallback?.();
      throw new SessionExpiredError();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) {
    clearTokens();
    onUnauthorizedCallback?.();
    throw new SessionExpiredError(data.message || 'Session expired');
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const api = {
  setOnUnauthorized: (callback) => {
    onUnauthorizedCallback = callback;
  },
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true
    }),
  logout: async () => {
    const refresh = getRefreshToken();
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
        skipAuth: true
      });
    } catch {
      /* still clear local session */
    } finally {
      clearTokens();
    }
  },
  getDevices: () => request('/devices'),
  getDeviceInfo: (id) => request(`/devices/${id}/info`),
  getDashboard: (id) => request(`/dashboard/${id}`),
  getAllDevicesDashboard: () => request('/dashboard/all'),
  getHistorical: (id, page = 1, limit = 50) =>
    request(`/data/${id}/historical?page=${page}&limit=${limit}`),
  getRecentReadings: (id, limit = 400) =>
    request(`/data/${id}/historical/recent?limit=${limit}`),
  getRange: (id, from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/data/${id}/historical/range${qs ? `?${qs}` : ''}`);
  },
  getSummary: (id) => request(`/data/${id}/historical/summary`),
  getConsumption: (id, interval = 'hourly') =>
    request(`/data/${id}/historical/consumption?interval=${interval}`),
  getLiveSnapshot: (id) => request(`/data/${id}/live`),
  getPeakDemand: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/peak-demand${qs ? `?${qs}` : ''}`);
  },
  getEnergyCost: (id, unitPrice, range = {}) => {
    const q = new URLSearchParams();
    q.set('unitPrice', String(unitPrice ?? 0));
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    return request(`/insights/${id}/energy-cost?${q}`);
  },
  getPowerFactor: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/power-factor${qs ? `?${qs}` : ''}`);
  },
  getPhaseImbalance: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/phase-imbalance${qs ? `?${qs}` : ''}`);
  },
  getVoltageStability: (id, nominalVoltage, range = {}) => {
    const q = new URLSearchParams();
    if (nominalVoltage != null) q.set('nominalVoltage', String(nominalVoltage));
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    return request(`/insights/${id}/voltage-stability?${q}`);
  },
  getReactivePower: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/reactive-power${qs ? `?${qs}` : ''}`);
  },
  getFrequencyStability: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/frequency-stability${qs ? `?${qs}` : ''}`);
  },
  getAnomalies: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/anomalies${qs ? `?${qs}` : ''}`);
  },
  getLoadProfile: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/load-profile${qs ? `?${qs}` : ''}`);
  },
  getHarmonicDistortion: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/harmonic-distortion${qs ? `?${qs}` : ''}`);
  },
  getDailyLoadCurve: (id, range = {}) => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const qs = q.toString();
    return request(`/insights/${id}/daily-load-curve${qs ? `?${qs}` : ''}`);
  },
  getCapacityUtilization: (id, ratedCapacity, range = {}) => {
    const q = new URLSearchParams();
    if (ratedCapacity != null) q.set('ratedCapacity', String(ratedCapacity));
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    return request(`/insights/${id}/capacity-utilization?${q}`);
  },
  getAlertsTimeline: (id, opts = {}) => {
    const q = new URLSearchParams();
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.ratedCapacity != null) q.set('ratedCapacity', String(opts.ratedCapacity));
    const qs = q.toString();
    return request(`/alerts/${id}/timeline${qs ? `?${qs}` : ''}`);
  },
  getAlertsLive: (id, ratedCapacity) => {
    const q = ratedCapacity != null ? `?ratedCapacity=${ratedCapacity}` : '';
    return request(`/alerts/${id}/live${q}`);
  },
  getUsers: () => request('/admin/users'),
  getSystemStatus: () => request('/admin/status'),
  reloadCsv: () => request('/admin/reload-csv', { method: 'POST' })
};
