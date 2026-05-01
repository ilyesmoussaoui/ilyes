import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

/**
 * LanguageSwitcher
 *
 * Reusable language toggle. Two visual variants:
 *  - `variant="full"` (default): renders radio-style cards for Settings page.
 *  - `variant="compact"`: minimal FR/EN pill for the header; cycles on click.
 */
export type LanguageSwitcherVariant = 'full' | 'compact';

interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant;
  className?: string;
}

const FLAGS: Record<SupportedLanguage, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
};

const LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

const CODES: Record<SupportedLanguage, string> = {
  fr: 'FR',
  en: 'EN',
};

function normalizeLang(raw: string | undefined): SupportedLanguage {
  const base = (raw ?? 'fr').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : 'fr';
}

export function LanguageSwitcher({
  variant = 'full',
  className,
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = useMemo(() => normalizeLang(i18n.resolvedLanguage ?? i18n.language), [i18n.resolvedLanguage, i18n.language]);

  const change = useCallback(
    (lang: SupportedLanguage) => {
      if (lang === current) return;
      void i18n.changeLanguage(lang);
    },
    [current, i18n],
  );

  if (variant === 'compact') {
    const next: SupportedLanguage = current === 'fr' ? 'en' : 'fr';
    return (
      <button
        type="button"
        onClick={() => change(next)}
        aria-label={t('language.toggleAria')}
        title={LABELS[next]}
        className={cn(
          'inline-flex h-8 min-w-[42px] items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-2 text-xs font-semibold text-neutral-700 transition-colors',
          'hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          className,
        )}
      >
        <span aria-hidden="true">{FLAGS[current]}</span>
        <span>{CODES[current]}</span>
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('language.title')}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = current === lang;
        return (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => change(lang)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-4 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
              selected
                ? 'border-primary-500 bg-primary-50 shadow-elevation-1'
                : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-neutral-50',
            )}
          >
            <span aria-hidden="true" className="text-2xl">
              {FLAGS[lang]}
            </span>
            <span className="flex flex-1 flex-col">
              <span
                className={cn(
                  'text-sm font-semibold',
                  selected ? 'text-primary-700' : 'text-neutral-800',
                )}
              >
                {LABELS[lang]}
              </span>
              <span className="text-xs text-neutral-500">{CODES[lang]}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                selected ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 bg-white',
              )}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-white" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
