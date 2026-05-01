import { NotesSection } from '../../profile/sections/NotesSection';
import type { MemberProfile } from '../../profile/profileTypes';

interface NotesTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

export function NotesTab({ profile, onSaved: _onSaved }: NotesTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <NotesSection memberId={profile.id} initialNotes={profile.notes} />
    </div>
  );
}
