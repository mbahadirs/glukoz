/** Aynı origin REST istemcisi: CSRF başlığı, tipli hatalar, oturum olayları. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const AUTH_EVENT = 'glk:unauthorized';
export const CONSENT_EVENT = 'glk:consent-required';

const CSRF_EXEMPT = ['/api/auth/login', '/api/setup'];

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

function csrfFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)glk_csrf=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null>;
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText || 'İstek başarısız';
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // gövde JSON değil
  }
  return new ApiError(res.status, code, message);
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && !CSRF_EXEMPT.includes(path)) {
    const token = csrfToken ?? csrfFromCookie();
    if (token) headers['x-csrf-token'] = token;
  }
  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: 'same-origin',
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await parseError(res);
    if (err.status === 401 && path !== '/api/auth/login')
      window.dispatchEvent(new Event(AUTH_EVENT));
    if (err.code === 'CONSENT_REQUIRED') window.dispatchEvent(new Event(CONSENT_EVENT));
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? await res.json() : await res.text()) as T;
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}
