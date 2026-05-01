import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Input, Card, useToast } from '../../components/ui';
import { EyeIcon, EyeOffIcon } from '../../components/ui/Icon';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useAuthStore } from './authStore';
import { ApiError } from '../../lib/api';

function useLoginSchema() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('auth.login.emailRequired'))
          .email(t('auth.login.validEmailRequired')),
        password: z.string().min(1, t('auth.login.passwordRequired')),
        rememberMe: z.boolean().optional(),
      }),
    [t],
  );
}
const loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const localizedSchema = useLoginSchema();
  const navigate = useNavigate();
  const location = useLocation();
  const { show } = useToast();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastEmail = useAuthStore((s) => s.lastEmail);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(localizedSchema),
    defaultValues: {
      email: lastEmail ?? '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (lastEmail) setValue('email', lastEmail);
  }, [lastEmail, setValue]);

  useEffect(() => {
    if (isAuthenticated) {
      const target = (location.state as LocationState | null)?.from ?? '/dashboard';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        rememberMe: values.rememberMe ?? false,
      });
      const target = (location.state as LocationState | null)?.from ?? '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'INVALID_CREDENTIALS'
            ? t('auth.login.invalidCredentials')
            : err.message
          : t('auth.login.somethingWentWrong');
      show({ type: 'error', title: t('auth.login.failed'), description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 px-4 py-12"
      role="main"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% -10%, rgba(37, 99, 235, 0.18), transparent 60%), radial-gradient(circle at 90% 90%, rgba(37, 99, 235, 0.12), transparent 50%)',
        }}
      />
      <div className="relative w-full max-w-[400px]">
        <div className="absolute right-0 top-0 -translate-y-10">
          <LanguageSwitcher variant="compact" />
        </div>
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white shadow-elevation-2">
            S
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">{t('auth.login.title')}</h1>
          <p className="text-sm text-neutral-500">{t('auth.login.subtitle')}</p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              type="email"
              label={t('auth.login.emailLabel')}
              autoComplete="email"
              placeholder={t('auth.login.emailPlaceholder')}
              error={errors.email?.message ?? null}
              {...register('email')}
            />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-neutral-700"
              >
                {t('auth.login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('auth.login.passwordPlaceholder')}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={
                    'h-10 w-full rounded-md border bg-white px-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:outline-none focus:ring-2 ' +
                    (errors.password
                      ? 'border-danger focus:border-danger focus:ring-danger/30'
                      : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-200')
                  }
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                {...register('rememberMe')}
              />
              <span>{t('auth.login.rememberMe')}</span>
            </label>

            <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
              {t('auth.login.submit')}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
