import type { ApiEnvelope } from '../types/auth';

const DEFAULT_BASE_URL = 'http://localhost:4000';

function getBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_BASE_URL;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRefresh?: boolean;
}

const REFRESH_EXCLUDED_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

type RefreshListener = (ok: boolean) => void;

let refreshInFlight: Promise<boolean> | null = null;
const refreshSubscribers: RefreshListener[] = [];

async function performRefresh(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildHeaders(body: unknown, headers: HeadersInit | undefined): Headers {
  const h = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData && !h.has('Content-Type')) {
    h.set('Content-Type', 'application/json');
  }
  if (!h.has('Accept')) {
    h.set('Accept', 'application/json');
  }
  return h;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

type OnAuthFailureHandler = () => void;
let onAuthFailure: OnAuthFailureHandler | null = null;

export function setOnAuthFailure(handler: OnAuthFailureHandler | null): void {
  onAuthFailure = handler;
}

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const text = await res.text();
  if (!text) {
    if (res.ok) {
      return { success: true, data: undefined as T };
    }
    return {
      success: false,
      error: { code: 'EMPTY_RESPONSE', message: 'Empty response from server' },
    };
  }
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: `Invalid JSON response (${res.status})`,
      },
    };
  }
}

function shouldAttemptRefresh(
  relativePath: string,
  status: number,
  skipAuthRefresh?: boolean,
): boolean {
  if (skipAuthRefresh) return false;
  if (status !== 401) return false;
  return !REFRESH_EXCLUDED_PATHS.some((excluded) => relativePath.startsWith(excluded));
}

async function waitForSharedRefresh(baseUrl: string): Promise<boolean> {
  if (refreshInFlight) {
    return new Promise<boolean>((resolve) => {
      refreshSubscribers.push(resolve);
    });
  }
  refreshInFlight = performRefresh(baseUrl);
  const ok = await refreshInFlight;
  refreshInFlight = null;
  while (refreshSubscribers.length) {
    const cb = refreshSubscribers.shift();
    cb?.(ok);
  }
  return ok;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const { body, headers, skipAuthRefresh, ...rest } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = normalizedPath.startsWith('/api/')
    ? normalizedPath
    : `/api/v1${normalizedPath}`;
  const url = `${baseUrl}${fullPath}`;

  const execute = async (): Promise<Response> =>
    fetch(url, {
      ...rest,
      credentials: 'include',
      headers: buildHeaders(body, headers),
      body: serializeBody(body),
    });

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
      0,
    );
  }

  const relativePath = fullPath.replace(/^\/api\/v1/, '');

  if (shouldAttemptRefresh(relativePath, response.status, skipAuthRefresh)) {
    const refreshed = await waitForSharedRefresh(baseUrl);
    if (refreshed) {
      try {
        response = await execute();
      } catch {
        throw new ApiError(
          'NETWORK_ERROR',
          'Cannot reach the server. Check your connection and try again.',
          0,
        );
      }
    } else {
      onAuthFailure?.();
      throw new ApiError(
        'UNAUTHENTICATED',
        'Session expired. Please sign in again.',
        401,
      );
    }
  }

  const envelope = await parseEnvelope<T>(response);

  if (!envelope.success) {
    if (
      response.status === 401 &&
      !REFRESH_EXCLUDED_PATHS.some((p) => relativePath.startsWith(p))
    ) {
      onAuthFailure?.();
    }
    throw new ApiError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.details,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      'HTTP_ERROR',
      `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return envelope.data;
}

export const api = {
  get: <T>(path: string, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
