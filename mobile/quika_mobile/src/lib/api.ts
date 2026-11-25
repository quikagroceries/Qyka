import { API_BASE } from '@/lib/config';

export type Role = 'customer' | 'agent' | 'rider' | 'shopkeeper' | 'admin';

export type User = {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: Role;
  status: string;
};

export type OtpResponse = {
  detail: string;
  channel: string;
  dev_otp: string | null;
  expires_in_seconds: number;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
}
// Called on any 401 while signed in, so an expired token signs the user out
// from wherever they are instead of leaving screens that silently fail.
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// FastAPI errors are { detail: string } or { detail: [{ msg }] }.
function readDetail(text: string): string {
  try {
    const d = JSON.parse(text)?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  } catch {}
  return text || 'Something went wrong';
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_BASE}. Is the backend running?`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, readDetail(text));
  }
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  requestOtp: (identifier: string, channel?: 'sms' | 'whatsapp' | 'voice') =>
    request<OtpResponse>('/auth/request-otp', {
      method: 'POST',
      body: { identifier, ...(channel ? { channel } : {}) },
    }),
  verifyOtp: (identifier: string, code: string) =>
    request<{ access_token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: { identifier, code },
    }),
  me: () => request<User>('/auth/me'),
};
