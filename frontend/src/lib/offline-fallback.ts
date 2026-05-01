import { ApiError } from './api';

/**
 * Detects failures that should trigger offline queueing rather than a user-facing
 * error. This covers:
 *  - `ApiError` with `code === 'NETWORK_ERROR'` (thrown by `apiFetch` when
 *    `fetch` rejects).
 *  - Raw `TypeError` ("Failed to fetch") — if a caller bypasses `apiFetch`.
 *  - `AbortError` on aborted requests.
 *  - `navigator.onLine === false` prior to the attempt.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.code === 'NETWORK_ERROR' || err.status === 0;
  }
  if (err instanceof TypeError) {
    // "Failed to fetch" / "NetworkError when attempting to fetch resource."
    return /fetch|network/i.test(err.message);
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }
  return false;
}

/**
 * Returns true if the caller should skip the network attempt entirely and
 * queue the mutation immediately (browser reports offline).
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * True when the error or the current environment indicates we should
 * fall back to the offline queue.
 */
export function shouldFallbackOffline(err: unknown): boolean {
  return isOffline() || isNetworkError(err);
}
