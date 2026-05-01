import { Card } from '../../../../components/ui';
import type { MemberProfile } from '../profileTypes';
import { formatDate } from '../profileUtils';
import { computeAge } from '../../helpers/validators';

interface IdentitySectionProps {
  profile: MemberProfile;
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
  arabic?: boolean;
}

function Field({ label, value, arabic = false }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd
        className={`text-sm font-medium text-neutral-900 ${arabic ? 'font-arabic' : ''}`}
        dir={arabic ? 'rtl' : undefined}
      >
        {value ?? <span className="text-neutral-300">—</span>}
      </dd>
    </div>
  );
}

export function IdentitySection({ profile }: IdentitySectionProps) {
  const fullNameLatin =
    [profile.firstNameLatin, profile.lastNameLatin].filter(Boolean).join(' ') || null;
  const fullNameArabic =
    [profile.firstNameArabic, profile.lastNameArabic].filter(Boolean).join(' ') || null;

  const genderLabel =
    profile.gender === 'male' ? 'Male' : profile.gender === 'female' ? 'Female' : null;

  const typeLabel =
    profile.type === 'athlete'
      ? 'Athlete'
      : profile.type === 'staff'
      ? 'Staff'
      : 'External';

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section aria-labelledby="identity-heading">
      <Card>
        <h2 id="identity-heading" className="sr-only">Identity</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Field label="Full name (Latin)" value={fullNameLatin} />
          <Field label="Full name (Arabic)" value={fullNameArabic} arabic />
          <Field label="Gender" value={genderLabel} />
          <Field
            label="Date of birth"
            value={
              profile.dateOfBirth ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{formatDate(profile.dateOfBirth)}</span>
                  {computeAge(profile.dateOfBirth) !== null && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {computeAge(profile.dateOfBirth)} yrs
                    </span>
                  )}
                </span>
              ) : null
            }
          />
          <Field label="Place of birth" value={profile.placeOfBirth} />
          <Field label="Member type" value={typeLabel} />
          <Field
            label="Status"
            value={
              <span className="capitalize">{profile.status}</span>
            }
          />
          <Field label="Member since" value={memberSince} />
        </dl>
      </Card>
    </section>
  );
}
