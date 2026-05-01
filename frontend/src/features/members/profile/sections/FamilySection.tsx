import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, ConfirmModal, Input, Select } from '../../../../components/ui';
import { useToast } from '../../../../components/ui';
import type { MemberProfile, FamilyLinkInfo } from '../profileTypes';
import { createFamilyLink, deleteFamilyLink } from '../profileApi';
import { PlusIcon, TrashIcon, UserIcon } from '../../../../components/ui/Icon';
import { api } from '../../../../lib/api';

interface FamilySectionProps {
  profile: MemberProfile;
  onProfileUpdated: () => void;
}

interface MemberSearchResult {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

function getMemberName(member: MemberSearchResult): string {
  const latin = [member.firstNameLatin, member.lastNameLatin].filter(Boolean).join(' ');
  const arabic = [member.firstNameArabic, member.lastNameArabic].filter(Boolean).join(' ');
  return latin || arabic || 'Unknown';
}

function FamilyMemberCard({
  link,
  currentMemberId,
  onDelete,
}: {
  link: FamilyLinkInfo;
  currentMemberId: string;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const photoUrl = link.relatedMemberPhoto
    ? `/api/v1/files/photos/${link.relatedMemberPhoto}`
    : null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFamilyLink(currentMemberId, link.id);
      onDelete(link.id);
      showToast({ type: 'success', title: 'Family link removed' });
    } catch {
      showToast({ type: 'error', title: 'Failed to remove family link' });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-elevation-1">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={link.relatedMemberName}
            className="h-10 w-10 rounded-full object-cover border border-neutral-200"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
            <UserIcon size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/members/${link.relatedMemberId}`}
            className="text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
          >
            {link.relatedMemberName}
          </Link>
          <p className="text-xs text-neutral-500 capitalize">{link.relationship}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label={`Remove ${link.relatedMemberName} family link`}
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-danger-bg hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          <TrashIcon size={15} />
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Remove family link"
        message={`Are you sure you want to remove the link with ${link.relatedMemberName}?`}
        confirmLabel="Remove"
        loading={deleting}
        destructive
      />
    </>
  );
}

export function FamilySection({ profile, onProfileUpdated }: FamilySectionProps) {
  const [links, setLinks] = useState<FamilyLinkInfo[]>(profile.familyLinks);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.get<{ members: MemberSearchResult[] }>(`/members?search=${encodeURIComponent(q)}&limit=10`);
      setSearchResults(res.members.filter((m) => m.id !== profile.id));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedMember) { setAddError('Please select a member.'); return; }
    if (!relationship) { setAddError('Please select a relationship.'); return; }
    if (links.some((l) => l.relatedMemberId === selectedMember.id)) {
      setAddError('This member is already linked.');
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const res = await createFamilyLink(profile.id, selectedMember.id, relationship);
      setLinks((prev) => [...prev, res.link]);
      onProfileUpdated();
      showToast({ type: 'success', title: 'Family link added' });
      setAddModalOpen(false);
      setSelectedMember(null);
      setRelationship(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch {
      setAddError('Failed to add family link. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    onProfileUpdated();
  };

  return (
    <>
      <section aria-labelledby="family-heading">
        <h2 id="family-heading" className="sr-only">Family Links</h2>

        <Card
          title="Family members"
          action={
            <Button
              variant="secondary"
              size="default"
              iconLeft={<PlusIcon size={15} />}
              onClick={() => setAddModalOpen(true)}
            >
              Add link
            </Button>
          }
        >
          {links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm font-medium text-neutral-700">No family links</p>
              <p className="text-xs text-neutral-500">
                Link related members to track family relationships.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {links.map((link) => (
                <li key={link.id}>
                  <FamilyMemberCard
                    link={link}
                    currentMemberId={profile.id}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Modal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setSelectedMember(null);
          setRelationship(null);
          setSearchQuery('');
          setSearchResults([]);
          setAddError(null);
        }}
        title="Add family link"
        description="Search for a member and specify the relationship"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Search member"
              placeholder="Type a name to search..."
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
            />
            {searchLoading && (
              <p className="mt-1 text-xs text-neutral-400">Searching...</p>
            )}
            {searchResults.length > 0 && !selectedMember && (
              <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-neutral-200 bg-white shadow-elevation-1">
                {searchResults.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(m);
                        setSearchQuery(getMemberName(m));
                        setSearchResults([]);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                    >
                      <UserIcon size={14} className="text-neutral-400" />
                      {getMemberName(m)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedMember && (
              <div className="mt-1 flex items-center justify-between rounded-md bg-primary-50 px-3 py-2 text-sm">
                <span className="font-medium text-primary-700">{getMemberName(selectedMember)}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedMember(null); setSearchQuery(''); }}
                  className="text-xs text-primary-500 hover:text-primary-700"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <Select
            label="Relationship"
            options={RELATIONSHIP_OPTIONS}
            value={relationship}
            onChange={setRelationship}
            placeholder="Select relationship..."
          />

          {addError && (
            <p className="text-xs text-danger-fg">{addError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setAddModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleAdd()}
              loading={saving}
            >
              Add link
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
