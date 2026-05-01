import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton, Card, Button } from '../../../components/ui';
import { ChevronRightIcon, EditIcon } from '../../../components/ui/Icon';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSidebar } from './ProfileSidebar';
import type { SectionId } from './ProfileSidebar';
import { getMemberProfile } from './profileApi';
import type { MemberProfile } from './profileTypes';
import { getDisplayName } from './profileUtils';

// Sections
import { OverviewSection } from './sections/OverviewSection';
import { IdentitySection } from './sections/IdentitySection';
import { ContactSection } from './sections/ContactSection';
import { DisciplinesSection } from './sections/DisciplinesSection';
import { DocumentsSection } from './sections/DocumentsSection';
import { AttendanceSection } from './sections/AttendanceSection';
import { PaymentsSection } from './sections/PaymentsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { FamilySection } from './sections/FamilySection';
import { NotesSection } from './sections/NotesSection';
import { AuditLogSection } from './sections/AuditLogSection';

/** Valid deep-link keys accepted via ?highlight= */
type HighlightKey = 'subscriptions' | 'payments' | 'balance' | 'documents' | 'attendance' | 'general';

const HIGHLIGHT_KEY_TO_SECTION: Record<HighlightKey, SectionId> = {
  subscriptions: 'payments',
  payments:      'payments',
  balance:       'payments',
  documents:     'documents',
  attendance:    'attendance',
  general:       'overview',
};

const VALID_HIGHLIGHT_KEYS = new Set<string>(Object.keys(HIGHLIGHT_KEY_TO_SECTION));

function isHighlightKey(val: string): val is HighlightKey {
  return VALID_HIGHLIGHT_KEYS.has(val);
}

const SECTION_TITLES: Record<SectionId, string> = {
  overview: 'Overview',
  identity: 'Identity',
  contact: 'Contact',
  disciplines: 'Disciplines',
  documents: 'Documents',
  attendance: 'Attendance',
  payments: 'Payments',
  equipment: 'Equipment',
  schedule: 'Schedule',
  family: 'Family',
  notes: 'Notes',
  audit: 'Audit Log',
};

function ProfilePageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header skeleton */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
        <div className="flex items-center gap-4">
          <Skeleton variant="avatar" width="96px" height="96px" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="25%" />
            <Skeleton variant="text" width="20%" />
          </div>
        </div>
      </div>
      {/* Body skeleton */}
      <div className="flex gap-4">
        <div className="hidden lg:flex flex-col gap-1 w-52">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} variant="text" height="36px" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton variant="card" />
        </div>
      </div>
    </div>
  );
}

export function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  /** Ref on the <main> content wrapper — used for scroll + highlight */
  const mainRef = useRef<HTMLElement>(null);
  /** Track the last highlight key we already acted on, to avoid re-firing */
  const lastHighlightRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMemberProfile(id);
      setProfile(res.member);
    } catch {
      setError('Failed to load member profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ── Deep-link: ?highlight=<key> ──────────────────────────────────────────
  // Step 1: when the param is present (and profile is loaded), switch to the
  //         target section.
  useEffect(() => {
    const rawKey = searchParams.get('highlight');
    if (!rawKey || !isHighlightKey(rawKey)) return;
    const targetSection = HIGHLIGHT_KEY_TO_SECTION[rawKey];
    setActiveSection(targetSection);
  }, [searchParams]);

  // Step 2: after the section has rendered (profile loaded + activeSection
  //         matches the highlight target), run scroll + animation.
  useEffect(() => {
    const rawKey = searchParams.get('highlight');
    if (!rawKey || !isHighlightKey(rawKey) || loading || !profile) return;

    const targetSection = HIGHLIGHT_KEY_TO_SECTION[rawKey];
    if (activeSection !== targetSection) return;

    // Avoid re-firing if the same key was already handled this render cycle
    const cacheKey = `${rawKey}:${targetSection}`;
    if (lastHighlightRef.current === cacheKey) return;
    lastHighlightRef.current = cacheKey;

    const el = mainRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const timer = setTimeout(() => {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (!reduceMotion) {
        el.classList.add('section-highlight');
        el.addEventListener(
          'animationend',
          () => { el.classList.remove('section-highlight'); },
          { once: true },
        );
      }
    }, 50);

    return () => { clearTimeout(timer); };
  }, [searchParams, activeSection, loading, profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ProfilePageSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-base font-semibold text-neutral-800">
              {error ?? 'Member not found'}
            </p>
            <p className="text-sm text-neutral-500">
              The member profile could not be loaded.
            </p>
            <div className="flex gap-2 mt-2">
              <Link
                to="/members"
                className="text-sm text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
              >
                Back to members
              </Link>
              {error && (
                <button
                  type="button"
                  onClick={() => void loadProfile()}
                  className="text-sm text-neutral-600 hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const displayName = getDisplayName(profile);
  const sectionTitle = SECTION_TITLES[activeSection];

  function renderSection() {
    if (!profile) return null;
    switch (activeSection) {
      case 'overview':
        return <OverviewSection profile={profile} onNavigate={setActiveSection} />;
      case 'identity':
        return <IdentitySection profile={profile} />;
      case 'contact':
        return <ContactSection profile={profile} />;
      case 'disciplines':
        return <DisciplinesSection profile={profile} />;
      case 'documents':
        return <DocumentsSection profile={profile} />;
      case 'attendance':
        return <AttendanceSection memberId={profile.id} />;
      case 'payments':
        return <PaymentsSection profile={profile} />;
      case 'equipment':
        return (
          <EquipmentSection
            profile={profile}
            onRefresh={() => void loadProfile()}
          />
        );
      case 'schedule':
        return <ScheduleSection profile={profile} />;
      case 'family':
        return (
          <FamilySection
            profile={profile}
            onProfileUpdated={() => void loadProfile()}
          />
        );
      case 'notes':
        return <NotesSection memberId={profile.id} initialNotes={profile.notes} />;
      case 'audit':
        return <AuditLogSection memberId={profile.id} />;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Home
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li>
            <Link
              to="/members"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Members
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="px-1 font-semibold text-neutral-700 truncate max-w-[160px]">{displayName}</li>
        </ol>
      </nav>

      {/* Profile header */}
      <div className="mb-2">
        <ProfileHeader profile={profile} onRefresh={() => void loadProfile()} />
      </div>

      {/* Edit button */}
      <div className="mb-4 flex justify-end">
        <Button
          variant="secondary"
          iconLeft={<EditIcon size={15} />}
          onClick={() => navigate(`/members/${id}/edit`)}
        >
          Edit Member
        </Button>
      </div>

      {/* Main layout: sidebar (handles both mobile tabs and desktop nav internally) + content */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
        <ProfileSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          profile={profile}
        />

        {/* Content area */}
        <main
          ref={mainRef}
          className="min-w-0 flex-1 rounded-lg"
          aria-label={sectionTitle}
          data-highlight-key={activeSection}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">{sectionTitle}</h2>
          </div>
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
