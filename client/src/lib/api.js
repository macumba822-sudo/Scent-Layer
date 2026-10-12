const TOKEN_KEY = 'sl_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let requestBody = body;
  if (body && path.startsWith('/api/ai/')) {
    requestBody = {
      ...body,
      language: localStorage.getItem('sl_ai_language') === 'en' ? 'en' : 'es',
    };
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
