export async function apiLogin(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
}

export async function apiGet(baseUrl, path, token) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || 'Request failed');
  return data;
}

export async function apiRefresh(baseUrl, refreshToken) {
  const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Session refresh failed');
  return data;
}

export async function apiPost(baseUrl, path, token, body) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));

  // 401 means either the access token expired ('Unauthorized'/'Invalid token')
  // or the endpoint rejected the payload (e.g. 'Invalid master password').
  // The caller refreshes and retries only for the token-expiry cases.
  if (res.status === 401) {
    const msg = data && data.message;
    if (!msg || msg === 'Unauthorized' || msg === 'Invalid token' || msg === 'Invalid token type') {
      throw new Error('SESSION_EXPIRED');
    }
  }

  if (!res.ok) throw new Error((data && data.message) || 'Request failed');
  return data;
}
