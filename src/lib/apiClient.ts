// src/lib/apiClient.ts
//
// Minimal fetch wrapper for API mutations (POST / PATCH / PUT / DELETE).
// Reads the token from localStorage directly so it can be called outside
// React hooks (e.g. form submit handlers that run after user interaction).
//
// Usage:
//   const data = await apiCall('POST', '/api/staff', body);

const TOKEN_KEY = 'bos_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiCall<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path:   string,
  body?:  unknown,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => ({ success: false, error: 'Invalid response' }));

  if (!json.success) {
    throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`);
  }

  return json.data as T;
}
