import { FamilySection } from '../../profile/sections/FamilySection';
import type { MemberProfile } from '../../profile/profileTypes';

interface FamilyTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

export function FamilyTab({ profile, onSaved }: FamilyTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <FamilySection profile={profile} onProfileUpdated={onSaved} />
    </div>
  );
}
