import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Icon, Modal, Skeleton } from '../components/ui';
import { Camera } from '../components/ui/Camera';
import { SyncStatusPill } from '../components/SyncStatusPill';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuthStore } from '../features/auth/authStore';
import { useDebounce } from '../hooks/useDebounce';
import { api, ApiError } from '../lib/api';
import type { Role } from '../types/auth';
import { NotificationPanel } from '../features/notifications/NotificationPanel';

// ─── Types ─────────────────────────────────────────────────────────────────

type SearchScope = 'all' | 'members' | 'payments' | 'products';

interface SearchMember {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  photoPath?: string | null;
  membershipStatus?: string | null;
}

interface SearchPayment {
  id: string;
  receiptNumber?: string | null;
  amount?: number | null;
  currency?: string | null;
  createdAt?: string | null;
}

interface SearchProduct {
  id: string;
  name: string;
  stock?: number | null;
}

interface SearchResults {
  members: SearchMember[];
  payments: SearchPayment[];
  products: SearchProduct[];
}

type FlatHit =
  | { kind: 'member'; id: string; item: SearchMember }
  | { kind: 'payment'; id: string; item: SearchPayment }
  | { kind: 'product'; id: string; item: SearchProduct };

interface FaceMatch {
  memberId: string;
  confidence: number;
  member: {
    firstNameLatin: string;
    lastNameLatin: string;
    photoPath?: string | null;
  };
}

interface FaceSearchResponse {
  matches: FaceMatch[];
}

interface UnreadCountResponse {
  count: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ROLE_KEY: Record<Role, string> = {
  admin: 'sidebar.roles.admin',
  manager: 'sidebar.roles.manager',
  receptionist: 'sidebar.roles.receptionist',
  coach: 'sidebar.roles.coach',
  accountant: 'sidebar.roles.accountant',
};

const ROLE_STYLES: Record<Role, string> = {
  admin: 'bg-primary-50 text-primary-700 border-primary-200',
  manager: 'bg-primary-50 text-primary-700 border-primary-200',
  receptionist: 'bg-info-bg text-info-fg border-info/20',
  coach: 'bg-success-bg text-success-fg border-success/20',
  accountant: 'bg-warning-bg text-warning-fg border-warning/30',
};

const SCOPE_KEYS: { value: SearchScope; labelKey: string; shortKey: string }[] = [
  { value: 'all', labelKey: 'header.scopes.all', shortKey: 'header.scopes.allShort' },
  { value: 'members', labelKey: 'header.scopes.members', shortKey: 'header.scopes.membersShort' },
  { value: 'payments', labelKey: 'header.scopes.payments', shortKey: 'header.scopes.paymentsShort' },
  { value: 'products', labelKey: 'header.scopes.products', shortKey: 'header.scopes.productsShort' },
];

const NOTIFICATION_POLL_MS = 60_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '';
  const cur = currency ?? 'DA';
  return `${amount.toLocaleString()} ${cur}`;
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.85) return 'bg-success-bg text-success-fg border-success/20';
  if (confidence >= 0.5) return 'bg-warning-bg text-warning-fg border-warning/30';
  return 'bg-danger-bg text-danger-fg border-danger/20';
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MemberAvatar({
  photo,
  name,
  size = 8,
}: {
  photo?: string | null;
  name: string;
  size?: number;
}) {
  const sizeClass = `h-${size} w-${size}`;
  if (photo) {
    return (
      <img
        src={photo}
        alt={`${name} — photo de profil`}
        className={cn(sizeClass, 'rounded-full object-cover shrink-0')}
      />
    );
  }
  return (
    <span
      className={cn(
        sizeClass,
        'rounded-full bg-primary-100 text-primary-600 text-xs font-semibold flex items-center justify-center shrink-0 select-none',
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ─── Scope Filter ───────────────────────────────────────────────────────────

function ScopeFilter({
  value,
  onChange,
}: {
  value: SearchScope;
  onChange: (s: SearchScope) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Desktop segmented control (≥640px) */}
      <div
        role="radiogroup"
        aria-label={t('header.searchScope')}
        className="hidden sm:inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden shrink-0"
      >
        {SCOPE_KEYS.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors duration-150 cursor-pointer',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 focus-visible:outline-none',
              i < SCOPE_KEYS.length - 1 && 'border-r border-neutral-200',
              value === opt.value
                ? 'bg-white text-primary-600 font-semibold shadow-elevation-1'
                : 'hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {/* Mobile select (<640px) */}
      <select
        aria-label={t('header.searchScope')}
        value={value}
        onChange={(e) => onChange(e.target.value as SearchScope)}
        className="sm:hidden h-9 rounded-md border border-neutral-200 bg-neutral-50 px-2 text-xs font-medium text-neutral-700 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none cursor-pointer shrink-0"
      >
        {SCOPE_KEYS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.shortKey)}
          </option>
        ))}
      </select>
    </>
  );
}

// ─── Facial-Search Modal ─────────────────────────────────────────────────────

function FaceSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<FaceMatch[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setMatches(null);
      setUploadError(null);
      setUploading(false);
    }
  }, [open]);

  const handleCapture = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      setUploadError(null);
      setMatches(null);

      try {
        if (blob.size > 5 * 1024 * 1024) {
          throw new Error(t('header.faceSearch.imageTooLarge'));
        }

        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        const data = await api.post<FaceSearchResponse>('/search/face', formData);
        setMatches(data.matches);
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setUploadError(err.message);
        } else if (err instanceof Error) {
          setUploadError(err.message);
        } else {
          setUploadError(t('header.faceSearch.uploadFailed'));
        }
      } finally {
        setUploading(false);
      }
    },
    [t],
  );

  const handleMatchClick = useCallback(
    (memberId: string) => {
      onClose();
      navigate(`/members/${memberId}`);
    },
    [navigate, onClose],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('header.faceSearch.title')}
      description={t('header.faceSearch.description')}
      size="md"
      closeOnOverlay={true}
    >
      <div className="flex flex-col gap-4">
        {/* Camera capture area — only show when no matches yet */}
        {matches === null && (
          <Camera
            onSave={(blob) => { void handleCapture(blob); }}
            onCancel={onClose}
            aspect={1}
            minOutput={300}
          />
        )}

        {/* Uploading indicator */}
        {uploading && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-500"
          >
            <Icon name="spinner" size={16} />
            <span>{t('header.faceSearch.analyzing')}</span>
          </div>
        )}

        {/* Upload error */}
        {uploadError && !uploading && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-fg"
          >
            <Icon name="alert" size={16} />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Results */}
        {matches !== null && !uploading && (
          <>
            {matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                {t('header.faceSearch.noMatches')}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-neutral-100 rounded-md border border-neutral-200 overflow-hidden">
                {matches.map((m) => {
                  const fullName = `${m.member.firstNameLatin} ${m.member.lastNameLatin}`;
                  const pct = Math.round(m.confidence * 100);
                  return (
                    <li key={m.memberId}>
                      <button
                        type="button"
                        onClick={() => handleMatchClick(m.memberId)}
                        className="flex items-center gap-3 px-3 py-2.5 w-full text-left cursor-pointer hover:bg-neutral-50 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                      >
                        <MemberAvatar
                          photo={m.member.photoPath}
                          name={fullName}
                          size={8}
                        />
                        <span className="text-sm font-medium text-neutral-900 truncate flex-1">
                          {fullName}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0',
                            confidenceClass(m.confidence),
                          )}
                        >
                          {pct}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setMatches(null); setUploadError(null); }}
                className="h-10 px-5 rounded-full border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                {t('header.faceSearch.searchAgain')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Header ─────────────────────────────────────────────────────────────

export function Header() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Account menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Search
  const searchInputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeHitId, setActiveHitId] = useState<string | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Flat list of hit ids for keyboard navigation (rebuilt per render via ref)
  const hitIdsRef = useRef<string[]>([]);

  // Camera / face search
  const [cameraActive, setCameraActive] = useState(false);
  const [faceModalOpen, setFaceModalOpen] = useState(false);

  // Notifications
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // ── Account menu: outside click + Escape ──────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  // ── Search: open dropdown when debounced query ≥ 2 chars ─────────────────
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setDropdownOpen(true);
      setActiveHitId(null);
    } else {
      setDropdownOpen(false);
      setActiveHitId(null);
    }
  }, [debouncedQuery]);

  // ── Search: close on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveHitId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // ── Notification unread count: mount + 60s interval ───────────────────────
  useEffect(() => {
    const fetchCount = () => {
      api
        .get<UnreadCountResponse>('/notifications/unread-count')
        .then((data) => setUnreadCount(data.count))
        .catch(() => {
          // Silently fail — badge stays at 0/previous value
        });
    };

    fetchCount();
    const id = setInterval(fetchCount, NOTIFICATION_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Notification panel: close on outside click ────────────────────────────
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notificationsOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) return;

    const ids = hitIdsRef.current;
    const currentIndex = activeHitId ? ids.indexOf(activeHitId) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex < ids.length - 1 ? ids[currentIndex + 1] : ids[0];
      if (next) setActiveHitId(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIndex > 0 ? ids[currentIndex - 1] : ids[ids.length - 1];
      if (prev) setActiveHitId(prev);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
      setActiveHitId(null);
      inputRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeHitId) {
        // Find and click the active hit element
        const el = document.getElementById(activeHitId);
        el?.click();
      } else {
        // Navigate to a full-results page — no generic route exists, so just close
        setDropdownOpen(false);
      }
    } else if (e.key === 'Tab') {
      setDropdownOpen(false);
      setActiveHitId(null);
    }
  };

  const handleHitSelect = useCallback(
    (hit: FlatHit) => {
      setDropdownOpen(false);
      setQuery('');
      setActiveHitId(null);

      switch (hit.kind) {
        case 'member':
          navigate(`/members/${hit.item.id}`);
          break;
        case 'payment': {
          const receipt = hit.item.receiptNumber;
          if (receipt) {
            navigate(`/payments?receipt=${encodeURIComponent(receipt)}`);
          } else {
            navigate('/payments');
          }
          break;
        }
        case 'product':
          navigate(`/inventory/${hit.item.id}`);
          break;
      }
    },
    [navigate],
  );

  const handleCameraToggle = () => {
    if (cameraActive) {
      setCameraActive(false);
      setFaceModalOpen(false);
    } else {
      setCameraActive(true);
      setFaceModalOpen(true);
    }
  };

  const handleFaceModalClose = () => {
    setFaceModalOpen(false);
    setCameraActive(false);
  };

  const handleHitIdsUpdate = useCallback((ids: string[]) => {
    hitIdsRef.current = ids;
  }, []);

  const userName = user?.fullNameLatin ?? t('header.signedIn');
  const userRole = user?.role;

  const notificationLabel =
    unreadCount === 0
      ? t('header.notifications')
      : t('header.notificationsWithCount', { count: unreadCount > 9 ? '9+' : unreadCount });

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-neutral-200 bg-white px-4"
        role="banner"
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          aria-label={`${t('app.name')} ${t('app.home')}`}
          className="flex items-center gap-2 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 shrink-0"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
            S
          </span>
          <span className="hidden text-sm font-semibold text-neutral-900 sm:inline">
            {t('app.name')}
          </span>
        </Link>

        {/* Search + scope filter */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div
            ref={searchWrapperRef}
            className="relative flex items-center w-full max-w-[560px] gap-2"
          >
            {/* Search input */}
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <Icon name="search" size={16} />
              </span>
              <input
                ref={inputRef}
                id={searchInputId}
                type="search"
                role="combobox"
                autoComplete="off"
                placeholder={t('header.searchPlaceholder')}
                aria-label={t('header.search')}
                aria-expanded={dropdownOpen}
                aria-controls={dropdownOpen ? listboxId : undefined}
                aria-activedescendant={activeHitId ?? undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-9 w-full rounded-full border border-transparent bg-neutral-50 pl-9 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
              />

              {/* Camera / face-search button */}
              <button
                type="button"
                aria-label={
                  cameraActive
                    ? t('header.faceSearch.active')
                    : t('header.faceSearch.inactive')
                }
                aria-pressed={cameraActive}
                onClick={handleCameraToggle}
                className={cn(
                  'absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150',
                  cameraActive
                    ? 'text-primary-600 bg-primary-50 ring-2 ring-primary-200 animate-icon-glow'
                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                )}
              >
                <Icon
                  name="camera"
                  size={16}
                  strokeWidth={cameraActive ? 2.5 : 2}
                />
              </button>

              {/* Search dropdown */}
              {dropdownOpen && debouncedQuery.length >= 2 && (
                <SearchDropdownWithIds
                  query={debouncedQuery}
                  scope={scope}
                  activeId={activeHitId}
                  listboxId={listboxId}
                  onSelect={handleHitSelect}
                  onHitIdsUpdate={handleHitIdsUpdate}
                />
              )}
            </div>

            {/* Scope filter */}
            <ScopeFilter value={scope} onChange={setScope} />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 shrink-0">
          <SyncStatusPill />

          {/* Language toggle */}
          <LanguageSwitcher variant="compact" />

          {/* Notification bell */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label={notificationLabel}
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon name="bell" size={18} />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white"
                >
                  {badgeText}
                </span>
              )}
            </button>
            <NotificationPanel
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onUnreadCountChange={setUnreadCount}
            />
          </div>

          {/* Account menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('header.accountMenu')}
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                {initials(userName)}
              </span>
              <span className="hidden items-center gap-2 pr-2 md:flex">
                <span className="text-sm font-medium text-neutral-800">{userName}</span>
                {userRole && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      ROLE_STYLES[userRole],
                    )}
                  >
                    {t(ROLE_KEY[userRole])}
                  </span>
                )}
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-elevation-3"
              >
                <div className="border-b border-neutral-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-neutral-900">{userName}</p>
                  {user?.email && (
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{user.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="user" size={16} />
                  <span>{t('header.profile')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-danger hover:bg-danger-bg/50 focus:bg-danger-bg/50 focus:outline-none"
                  onClick={() => { void handleLogout(); }}
                >
                  <Icon name="log-out" size={16} />
                  <span>{t('header.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Face search modal — rendered outside the header to avoid z-index issues */}
      <FaceSearchModal open={faceModalOpen} onClose={handleFaceModalClose} />
    </>
  );
}

// ─── SearchDropdown wrapper that also reports hit ids upward ─────────────────

function SearchDropdownWithIds({
  query,
  scope,
  activeId,
  listboxId,
  onSelect,
  onHitIdsUpdate,
}: {
  query: string;
  scope: SearchScope;
  activeId: string | null;
  listboxId: string;
  onSelect: (hit: FlatHit) => void;
  onHitIdsUpdate: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setStatus('idle');
      setResults(null);
      onHitIdsUpdate([]);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setErrorMsg(null);
    onHitIdsUpdate([]);

    const params = new URLSearchParams({ q: query, scope });
    api
      .get<SearchResults>(`/search?${params.toString()}`, { signal: ctrl.signal } as Parameters<typeof api.get>[1])
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setResults(data);
        setStatus('success');

        const ids: string[] = [];
        data.members.forEach((m) => ids.push(`hit-member-${m.id}`));
        data.payments.forEach((p) => ids.push(`hit-payment-${p.id}`));
        data.products.forEach((pr) => ids.push(`hit-product-${pr.id}`));
        onHitIdsUpdate(ids);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg(t('header.results.searchError'));
        }
        setStatus('error');
        onHitIdsUpdate([]);
      });

    return () => ctrl.abort();
  }, [query, scope, onHitIdsUpdate, t]);

  if (status === 'idle') return null;

  const members = results?.members ?? [];
  const payments = results?.payments ?? [];
  const products = results?.products ?? [];
  const hasResults = members.length > 0 || payments.length > 0 || products.length > 0;

  return (
    <div className="absolute left-0 top-[calc(100%+4px)] w-full z-50 rounded-md border border-neutral-200 bg-white shadow-elevation-3 overflow-hidden animate-slide-up">
      <ul
        id={listboxId}
        role="listbox"
        aria-label={t('header.search')}
        className="max-h-[420px] overflow-y-auto"
      >
        {status === 'loading' && (
          <>
            <li role="option" aria-selected={false} aria-disabled="true">
              <Skeleton variant="row" />
            </li>
            <li role="option" aria-selected={false} aria-disabled="true">
              <Skeleton variant="row" />
            </li>
            <li role="option" aria-selected={false} aria-disabled="true">
              <Skeleton variant="row" />
            </li>
          </>
        )}

        {status === 'error' && (
          <li
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="flex items-center gap-2 px-4 py-3 text-sm text-danger"
          >
            <Icon name="alert" size={16} />
            <span>{errorMsg ?? t('header.results.searchError')}</span>
          </li>
        )}

        {status === 'success' && !hasResults && (
          <li
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="flex flex-col items-center justify-center py-8 gap-2"
          >
            <Icon name="search" size={32} className="text-neutral-200" />
            <span className="text-neutral-500 text-sm">
              {t('header.results.noResultsFor', { query })}
            </span>
          </li>
        )}

        {status === 'success' && hasResults && (
          <>
            {members.length > 0 && (
              <>
                <li
                  role="presentation"
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 bg-neutral-50 sticky top-0"
                >
                  {t('header.results.members', { count: members.length })}
                </li>
                {members.map((m) => {
                  const fullName = `${m.firstNameLatin} ${m.lastNameLatin}`;
                  const hitId = `hit-member-${m.id}`;
                  return (
                    <li
                      key={m.id}
                      id={hitId}
                      role="option"
                      aria-selected={activeId === hitId}
                      onClick={() => onSelect({ kind: 'member', id: hitId, item: m })}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100',
                        'hover:bg-neutral-50',
                        activeId === hitId && 'bg-primary-50',
                      )}
                    >
                      <MemberAvatar photo={m.photoPath} name={fullName} size={8} />
                      <span className="text-sm font-medium text-neutral-900 truncate flex-1">
                        {fullName}
                      </span>
                      {m.membershipStatus && (
                        <span className="text-xs text-neutral-400 shrink-0">
                          {m.membershipStatus}
                        </span>
                      )}
                    </li>
                  );
                })}
              </>
            )}

            {payments.length > 0 && (
              <>
                <li
                  role="presentation"
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 bg-neutral-50 sticky top-0"
                >
                  {t('header.results.payments', { count: payments.length })}
                </li>
                {payments.map((p) => {
                  const hitId = `hit-payment-${p.id}`;
                  const label = p.receiptNumber
                    ? t('header.results.receipt', { number: p.receiptNumber })
                    : t('header.results.payment', { id: p.id.slice(0, 8) });
                  const secondary = [
                    formatAmount(p.amount, p.currency),
                    p.createdAt ? new Date(p.createdAt).toLocaleDateString() : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li
                      key={p.id}
                      id={hitId}
                      role="option"
                      aria-selected={activeId === hitId}
                      onClick={() => onSelect({ kind: 'payment', id: hitId, item: p })}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100',
                        'hover:bg-neutral-50',
                        activeId === hitId && 'bg-primary-50',
                      )}
                    >
                      <span className="h-8 w-8 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                        <Icon name="credit-card" size={16} />
                      </span>
                      <span className="text-sm font-medium text-neutral-900 truncate flex-1">
                        {label}
                      </span>
                      {secondary && (
                        <span className="text-xs text-neutral-400 shrink-0">{secondary}</span>
                      )}
                    </li>
                  );
                })}
              </>
            )}

            {products.length > 0 && (
              <>
                <li
                  role="presentation"
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 bg-neutral-50 sticky top-0"
                >
                  {t('header.results.products', { count: products.length })}
                </li>
                {products.map((pr) => {
                  const hitId = `hit-product-${pr.id}`;
                  const stockLabel =
                    pr.stock == null
                      ? ''
                      : pr.stock === 0
                        ? t('header.results.stockEmpty')
                        : t('header.results.stockUnits', { count: pr.stock });
                  return (
                    <li
                      key={pr.id}
                      id={hitId}
                      role="option"
                      aria-selected={activeId === hitId}
                      onClick={() => onSelect({ kind: 'product', id: hitId, item: pr })}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100',
                        'hover:bg-neutral-50',
                        activeId === hitId && 'bg-primary-50',
                      )}
                    >
                      <span className="h-8 w-8 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                        <Icon name="package" size={16} />
                      </span>
                      <span className="text-sm font-medium text-neutral-900 truncate flex-1">
                        {pr.name}
                      </span>
                      {stockLabel && (
                        <span className="text-xs text-neutral-400 shrink-0">{stockLabel}</span>
                      )}
                    </li>
                  );
                })}
              </>
            )}

            <li
              role="presentation"
              className="px-3 py-2 text-xs text-neutral-400 border-t border-neutral-100 flex items-center justify-between"
            >
              <span>{t('header.results.enterToSelect')}</span>
              <span>{t('header.results.escToClose')}</span>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
