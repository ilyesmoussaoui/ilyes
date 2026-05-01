import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchIcon, SpinnerIcon, InboxIcon, UserIcon } from '../../../components/ui/Icon';
import { kioskSearch, kioskCheckIn } from '../kioskApi';
import type { SearchMember } from '../kioskApi';
import { cn } from '../../../lib/cn';
import { ApiError } from '../../../lib/api';
import { useSoundAlerts } from '../hooks/useSoundAlerts';
import { queueAttendanceCheckIn } from '../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../lib/offline-fallback';

interface ManualSearchProps {
  onCheckInSuccess: () => void;
}

type SearchState = 'idle' | 'loading' | 'success' | 'error';
type CheckInState = { memberId: string; status: 'loading' | 'success' | 'error'; message: string } | null;

export function ManualSearch({ onCheckInSuccess }: ManualSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMember[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [checkInState, setCheckInState] = useState<CheckInState>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playSuccess, playError } = useSoundAlerts();

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    setSearchState('loading');
    setSearchError(null);

    try {
      const data = await kioskSearch(q.trim());
      setResults(data.members);
      setSearchState('success');
    } catch (err) {
      setSearchState('error');
      setSearchError(
        err instanceof ApiError ? err.message : 'Search failed. Please try again.',
      );
      setResults([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void performSearch(value);
    }, 300);
  };

  const handleCheckIn = async (member: SearchMember) => {
    setCheckInState({ memberId: member.id, status: 'loading', message: 'Checking in...' });

    const memberLabel = `${member.firstNameLatin} ${member.lastNameLatin}`.trim();
    const queueOffline = async () => {
      await queueAttendanceCheckIn({
        memberId: member.id,
        memberLabel,
        method: 'manual',
      });
      setCheckInState({
        memberId: member.id,
        status: 'success',
        message: `${member.firstNameLatin} saved offline — will sync when online.`,
      });
      playSuccess();
      setTimeout(() => {
        setCheckInState(null);
        setQuery('');
        setResults([]);
        setSearchState('idle');
        onCheckInSuccess();
      }, 3000);
    };

    try {
      if (isOffline()) {
        await queueOffline();
        return;
      }
      await kioskCheckIn({
        member_id: member.id,
        method: 'manual',
      });
      setCheckInState({
        memberId: member.id,
        status: 'success',
        message: `${member.firstNameLatin} checked in!`,
      });
      playSuccess();

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setCheckInState(null);
        setQuery('');
        setResults([]);
        setSearchState('idle');
        onCheckInSuccess();
      }, 3000);
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        try {
          await queueOffline();
          return;
        } catch {
          /* fall through to error UI */
        }
      }
      playError();
      setCheckInState({
        memberId: member.id,
        status: 'error',
        message: err instanceof ApiError ? err.message : 'Check-in failed.',
      });
      setTimeout(() => setCheckInState(null), 4000);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusBadge = (status: SearchMember['subscriptionStatus']) => {
    const styles: Record<typeof status, string> = {
      active: 'bg-green-500/20 text-green-300 border-green-500/30',
      expired: 'bg-red-500/20 text-red-300 border-red-500/30',
      none: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
    };
    const labels: Record<typeof status, string> = {
      active: 'Active',
      expired: 'Expired',
      none: 'None',
    };
    return (
      <span className={cn('rounded-full border px-3 py-1 text-sm font-medium', styles[status])}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6 lg:p-8">
      {/* Search input */}
      <div className="relative">
        <label htmlFor="kiosk-search" className="sr-only">
          Search members by name
        </label>
        <SearchIcon
          size={28}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          ref={inputRef}
          id="kiosk-search"
          type="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search by name..."
          autoComplete="off"
          className="w-full rounded-2xl border-2 border-neutral-600 bg-neutral-800 py-5 pl-14 pr-5 text-2xl font-medium text-white placeholder-neutral-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-0"
        />
        {searchState === 'loading' && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <SpinnerIcon size={24} className="animate-spin text-neutral-400" />
          </div>
        )}
      </div>

      {/* Check-in status banner */}
      {checkInState && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl px-6 py-4 text-center text-xl font-bold',
            checkInState.status === 'success' && 'bg-green-600 text-white',
            checkInState.status === 'error' && 'bg-red-600 text-white',
            checkInState.status === 'loading' && 'bg-neutral-700 text-neutral-300',
          )}
        >
          {checkInState.message}
        </div>
      )}

      {/* Error state */}
      {searchState === 'error' && searchError && (
        <div role="alert" className="rounded-xl bg-red-500/10 px-6 py-4 text-center text-lg text-red-300">
          {searchError}
        </div>
      )}

      {/* Results grid */}
      <div className="min-h-0 flex-1 overflow-y-auto" role="region" aria-label="Search results">
        {searchState === 'idle' && query.length < 2 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-neutral-500">
            <SearchIcon size={48} />
            <p className="text-xl">Type at least 2 characters to search</p>
          </div>
        )}

        {searchState === 'success' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-neutral-500">
            <InboxIcon size={48} />
            <p className="text-xl">No members found for &quot;{query}&quot;</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((member) => {
              const isChecking = checkInState?.memberId === member.id;
              const fullName = `${member.firstNameLatin} ${member.lastNameLatin}`;
              const fullNameArabic =
                member.firstNameArabic && member.lastNameArabic
                  ? `${member.firstNameArabic} ${member.lastNameArabic}`
                  : null;

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => void handleCheckIn(member)}
                  disabled={isChecking || checkInState?.status === 'loading'}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border border-neutral-700 bg-neutral-800/80 p-5 text-left transition-all',
                    'hover:border-primary-500 hover:bg-neutral-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isChecking && checkInState?.status === 'success' && 'border-green-500 bg-green-900/30',
                  )}
                  aria-label={`Check in ${fullName}`}
                >
                  {/* Photo */}
                  {member.photoPath ? (
                    <img
                      src={member.photoPath}
                      alt={`Photo of ${fullName}`}
                      className="h-16 w-16 shrink-0 rounded-full border-2 border-neutral-600 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-700 text-neutral-400">
                      <UserIcon size={28} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-white">{fullName}</p>
                    {fullNameArabic && (
                      <p className="truncate font-arabic text-base text-neutral-400" dir="rtl">
                        {fullNameArabic}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {statusBadge(member.subscriptionStatus)}
                      {member.disciplines.length > 0 && (
                        <span className="truncate text-sm text-neutral-500">
                          {member.disciplines.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Loading indicator on the tile */}
                  {isChecking && checkInState?.status === 'loading' && (
                    <SpinnerIcon size={24} className="shrink-0 animate-spin text-primary-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
