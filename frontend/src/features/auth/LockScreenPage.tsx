import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { EyeIcon, EyeOffIcon, LockIcon } from '../../components/ui/Icon';
import { useAuthStore } from './authStore';
import { ApiError } from '../../lib/api';

interface LocationState {
  from?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function LockScreenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const lastEmail = useAuthStore((s) => s.lastEmail);
  const unlock = useAuthStore((s) => s.unlock);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const displayName = user?.fullNameLatin ?? lastEmail ?? 'there';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await unlock(password);
      const target = (location.state as LocationState | null)?.from ?? '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === 'INVALID_CREDENTIALS'
          ? 'Incorrect password'
          : err instanceof Error
            ? err.message
            : 'Could not unlock session';
      setError(message);
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFullSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-4 py-12"
      role="main"
      style={{
        background:
          'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(29, 78, 216, 0.85))',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 backdrop-blur-xl"
      />
      <div
        className={
          'relative w-full max-w-[400px] rounded-2xl border border-white/10 bg-white/95 p-8 shadow-elevation-3 ' +
          (shake ? 'animate-shake' : '')
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-xl font-semibold text-white">
              {user ? initials(user.fullNameLatin) : <LockIcon size={24} />}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white">
              <LockIcon size={12} />
            </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Welcome back, {displayName}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Session locked due to inactivity — enter your password to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="lock-password" className="text-sm font-medium text-neutral-700">
              Password
            </label>
            <div className="relative">
              <input
                id="lock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'lock-error' : undefined}
                className={
                  'h-10 w-full rounded-md border bg-white px-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:outline-none focus:ring-2 ' +
                  (error
                    ? 'border-danger focus:border-danger focus:ring-danger/30'
                    : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-200')
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
            {error && (
              <p id="lock-error" className="text-xs text-danger">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
            Unlock
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleFullSignOut}
            className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </main>
  );
}
