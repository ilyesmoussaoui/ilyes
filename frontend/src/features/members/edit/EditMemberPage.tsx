import { useState, useCallback, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Skeleton, Card } from '../../../components/ui';
import { ChevronRightIcon } from '../../../components/ui/Icon';
import { getMemberProfile } from '../profile/profileApi';
import type { MemberProfile } from '../profile/profileTypes';
import { getDisplayName } from '../profile/profileUtils';

import { EditHeader } from './EditHeader';
import { EditTabNav } from './EditTabNav';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import type { EditTabId } from './editTypes';

import { IdentityTab } from './tabs/IdentityTab';
import { PhotoTab } from './tabs/PhotoTab';
import { ContactTab } from './tabs/ContactTab';
import { DisciplinesTab } from './tabs/DisciplinesTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { BillingTab } from './tabs/BillingTab';
import { EquipmentTab } from './tabs/EquipmentTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { FamilyTab } from './tabs/FamilyTab';
import { NotesTab } from './tabs/NotesTab';
import { AuditLogTab } from './tabs/AuditLogTab';

const TAB_TITLES: Record<EditTabId, string> = {
  identity: 'Identity',
  photo: 'Photo',
  contact: 'Contact',
  disciplines: 'Disciplines',
  documents: 'Documents',
  billing: 'Billing',
  equipment: 'Equipment',
  schedule: 'Schedule',
  family: 'Family',
  notes: 'Notes',
  audit: 'Audit Log',
};

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex items-center gap-4">
          <Skeleton variant="avatar" width="48px" height="48px" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="text" width="20%" />
          </div>
        </div>
      </div>
      <Skeleton variant="text" height="44px" />
      <Skeleton variant="card" />
    </div>
  );
}

export function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditTabId>('identity');
  const [isDirty, setIsDirty] = useState(false);

  // Unsaved changes guard
  const [pendingTab, setPendingTab] = useState<EditTabId | null>(null);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);

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

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleTabClick = (tabId: EditTabId) => {
    if (tabId === activeTab) return;
    if (isDirty) {
      setPendingTab(tabId);
      setUnsavedModalOpen(true);
    } else {
      setActiveTab(tabId);
      setIsDirty(false);
    }
  };

  const handleDiscardAndSwitch = () => {
    setUnsavedModalOpen(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setIsDirty(false);
    }
    setPendingTab(null);
  };

  const handleStay = () => {
    setUnsavedModalOpen(false);
    setPendingTab(null);
  };

  const handleSaved = useCallback(() => {
    setIsDirty(false);
    void loadProfile();
  }, [loadProfile]);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PageSkeleton />
      </div>
    );
  }

  if (error || !profile || !id) {
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
            <div className="flex gap-3 mt-2">
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

  function renderTab() {
    if (!profile || !id) return null;
    switch (activeTab) {
      case 'identity':
        return (
          <IdentityTab
            profile={profile}
            onSaved={handleSaved}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'photo':
        return <PhotoTab profile={profile} onSaved={handleSaved} />;
      case 'contact':
        return (
          <ContactTab
            profile={profile}
            onSaved={handleSaved}
            onDirtyChange={handleDirtyChange}
          />
        );
      /* Auto-save tabs — changes are saved immediately per action, no form-level dirty tracking needed */
      case 'disciplines':
        return <DisciplinesTab profile={profile} onSaved={handleSaved} />;
      case 'documents':
        return <DocumentsTab profile={profile} onSaved={handleSaved} />;
      case 'billing':
        return <BillingTab profile={profile} onSaved={handleSaved} />;
      case 'equipment':
        return <EquipmentTab profile={profile} />;
      case 'schedule':
        return <ScheduleTab profile={profile} />;
      case 'family':
        return <FamilyTab profile={profile} onSaved={handleSaved} />;
      case 'notes':
        return <NotesTab profile={profile} onSaved={handleSaved} />;
      case 'audit':
        return <AuditLogTab memberId={id} />;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
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
          <li>
            <Link
              to={`/members/${id}`}
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 truncate max-w-[120px] inline-block"
            >
              {displayName}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="px-1 font-semibold text-neutral-700">Edit</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-4">
        <EditHeader profile={profile} />
      </div>

      {/* Tabs + content */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
        <EditTabNav
          activeTab={activeTab}
          isDirty={isDirty}
          onTabClick={handleTabClick}
        />

        <main
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="p-4 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">
              {TAB_TITLES[activeTab]}
            </h2>
          </div>
          {renderTab()}
        </main>
      </div>

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={unsavedModalOpen}
        onStay={handleStay}
        onDiscard={handleDiscardAndSwitch}
      />
    </div>
  );
}
