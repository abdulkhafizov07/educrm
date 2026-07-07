const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

// JSON soʻrovlar uchun asosiy funksiya
async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...init } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
    });
    const qs = query.toString();
    if (qs) url += `?${qs}`;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
      const retryRes = await fetch(url, { ...init, headers });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${retryRes.status}`);
      }
      return retryRes.json();
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Token yangilash
async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// FormData (rasm va fayllar) uchun alohida funksiya
async function requestFormData<T = unknown>(
  endpoint: string,
  method: 'POST' | 'PUT',
  formData: FormData
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Content-Type qo'yilmaydi – brauzer o'zi multipart/form-data qilib yuboradi

  const res = await fetch(url, {
    method,
    headers,
    body: formData,
  });

  // 401 da refresh
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
      const retryRes = await fetch(url, {
        method,
        headers,
        body: formData,
      });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${retryRes.status}`);
      }
      return retryRes.json();
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // JSON metodlar
  get: <T = unknown>(endpoint: string, params?: RequestOptions['params']) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T = unknown>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  // FormData metodlar (fayl yuklash uchun)
  postFormData: <T = unknown>(endpoint: string, formData: FormData) =>
    requestFormData<T>(endpoint, 'POST', formData),

  putFormData: <T = unknown>(endpoint: string, formData: FormData) =>
    requestFormData<T>(endpoint, 'PUT', formData),

  // Eski upload (POST uchun qisqartma)
  upload: <T = unknown>(endpoint: string, formData: FormData) =>
    requestFormData<T>(endpoint, 'POST', formData),
};