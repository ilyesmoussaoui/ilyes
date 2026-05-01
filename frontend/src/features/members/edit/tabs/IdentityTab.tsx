import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, DatePicker, Button, Card } from '../../../../components/ui';
import { SpinnerIcon, AlertIcon } from '../../../../components/ui/Icon';
import { useEditForm } from '../useEditForm';
import type { IdentityFormState } from '../editTypes';
import type { MemberProfile } from '../../profile/profileTypes';
import { updateMemberIdentity } from '../editApi';
import { queueMemberUpdate } from '../../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../../lib/offline-fallback';
import {
  sanitizeLatinName,
  capitalizeWords,
  sanitizeArabicName,
  isFutureDate,
  computeAge,
  schoolLevelForAge,
} from '../../helpers/validators';
import { getWilayas } from '../../api/membersApi';
import type { SelectOption } from '../../../../types/ui';
import { useToast } from '../../../../components/ui/Toast';

interface IdentityTabProps {
  profile: MemberProfile;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

function profileToIdentityState(profile: MemberProfile): IdentityFormState {
  // Extract wilaya code from stored placeOfBirth string (format: "01 - Name")
  const wilayaCode = profile.placeOfBirth
    ? profile.placeOfBirth.split(' - ')[0]?.trim() ?? ''
    : '';

  return {
    firstNameLatin: profile.firstNameLatin ?? '',
    lastNameLatin: profile.lastNameLatin ?? '',
    firstNameArabic: profile.firstNameArabic ?? '',
    lastNameArabic: profile.lastNameArabic ?? '',
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    placeOfBirth: wilayaCode,
  };
}

function validateIdentity(data: IdentityFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.firstNameLatin.trim()) {
    errors.firstNameLatin = 'First name (Latin) is required';
  } else if (data.firstNameLatin.trim().length < 2) {
    errors.firstNameLatin = 'First name must be at least 2 characters';
  }

  if (!data.lastNameLatin.trim()) {
    errors.lastNameLatin = 'Last name (Latin) is required';
  } else if (data.lastNameLatin.trim().length < 2) {
    errors.lastNameLatin = 'Last name must be at least 2 characters';
  }

  if (!data.gender) {
    errors.gender = 'Gender is required';
  }

  if (!data.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required';
  } else if (isFutureDate(data.dateOfBirth)) {
    errors.dateOfBirth = 'Date of birth cannot be in the future';
  }

  if (!data.placeOfBirth) {
    errors.placeOfBirth = 'Place of birth is required';
  }

  return errors;
}

export function IdentityTab({ profile, onSaved, onDirtyChange }: IdentityTabProps) {
  const { showToast } = useToast();

  const wilayasQuery = useQuery({
    queryKey: ['wilayas'],
    queryFn: getWilayas,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const wilayaOptions = useMemo<SelectOption[]>(() => {
    const list = wilayasQuery.data?.wilayas ?? [];
    return list.map((w) => ({
      value: w.code,
      label: `${w.code} - ${w.nameLatin} / ${w.nameArabic}`,
    }));
  }, [wilayasQuery.data]);

  const initialData = useMemo(() => profileToIdentityState(profile), [profile]);
  const queuedOfflineRef = useRef(false);

  const { formData, setField, errors, isDirty, isValid, isSaving, saveError, save, cancel } =
    useEditForm<IdentityFormState>({
      initialData,
      onSave: async (data) => {
        const wilaya = wilayasQuery.data?.wilayas.find(
          (w) => w.code === data.placeOfBirth,
        );
        const placeOfBirth = wilaya
          ? `${wilaya.code} - ${wilaya.nameLatin}`
          : data.placeOfBirth || null;

        const patch = {
          firstNameLatin: data.firstNameLatin.trim(),
          lastNameLatin: data.lastNameLatin.trim(),
          firstNameArabic: data.firstNameArabic.trim() || null,
          lastNameArabic: data.lastNameArabic.trim() || null,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          placeOfBirth,
        };
        const memberLabel = `${patch.firstNameLatin} ${patch.lastNameLatin}`.trim() || 'Member';

        queuedOfflineRef.current = false;
        if (isOffline()) {
          await queueMemberUpdate({ memberId: profile.id, memberLabel, patch });
          queuedOfflineRef.current = true;
          return;
        }
        try {
          await updateMemberIdentity(profile.id, patch);
        } catch (err) {
          if (shouldFallbackOffline(err)) {
            await queueMemberUpdate({ memberId: profile.id, memberLabel, patch });
            queuedOfflineRef.current = true;
            return;
          }
          throw err;
        }
      },
      validate: validateIdentity,
    });

  // Notify parent of dirty state change
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      showToast(
        queuedOfflineRef.current
          ? {
              type: 'success',
              title: 'Saved offline',
              description: 'Identity will sync when the connection returns.',
            }
          : { type: 'success', title: 'Identity saved' },
      );
      onSaved();
      onDirtyChange(false);
    }
  };

  const age = formData.dateOfBirth ? computeAge(formData.dateOfBirth) : null;
  const schoolLevel = age !== null ? schoolLevelForAge(age) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-6">
          {/* Latin names */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Name (Latin)
              </h3>
              <Input
                label="First name"
                value={formData.firstNameLatin}
                onChange={(e) =>
                  setField('firstNameLatin', sanitizeLatinName(e.target.value))
                }
                onBlur={() =>
                  setField(
                    'firstNameLatin',
                    capitalizeWords(formData.firstNameLatin),
                  )
                }
                maxLength={40}
                error={errors.firstNameLatin ?? null}
                autoComplete="given-name"
                direction="ltr"
              />
              <Input
                label="Last name"
                value={formData.lastNameLatin}
                onChange={(e) =>
                  setField('lastNameLatin', sanitizeLatinName(e.target.value))
                }
                onBlur={() =>
                  setField(
                    'lastNameLatin',
                    capitalizeWords(formData.lastNameLatin),
                  )
                }
                maxLength={40}
                error={errors.lastNameLatin ?? null}
                autoComplete="family-name"
                direction="ltr"
              />
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Name (Arabic)
              </h3>
              <Input
                label="First name"
                value={formData.firstNameArabic}
                onChange={(e) =>
                  setField(
                    'firstNameArabic',
                    sanitizeArabicName(e.target.value),
                  )
                }
                maxLength={40}
                direction="rtl"
              />
              <Input
                label="Last name"
                value={formData.lastNameArabic}
                onChange={(e) =>
                  setField(
                    'lastNameArabic',
                    sanitizeArabicName(e.target.value),
                  )
                }
                maxLength={40}
                direction="rtl"
              />
            </section>
          </div>

          {/* Gender + DOB */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Gender"
              placeholder="Select gender"
              options={GENDER_OPTIONS}
              value={formData.gender}
              onChange={(v) => setField('gender', v as 'male' | 'female')}
              error={errors.gender ?? null}
            />
            <div>
              <DatePicker
                label="Date of birth"
                value={formData.dateOfBirth}
                setValue={(iso) => setField('dateOfBirth', iso)}
                minYear={1930}
                error={errors.dateOfBirth ?? null}
              />
              {age !== null && schoolLevel && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                    Age: {age} years
                  </span>
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                    School level: {schoolLevel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Place of birth */}
          <div className="max-w-md">
            <Select
              label="Place of birth (wilaya)"
              placeholder={
                wilayasQuery.isLoading ? 'Loading wilayas...' : 'Select wilaya'
              }
              options={wilayaOptions}
              value={formData.placeOfBirth || null}
              onChange={(v) => setField('placeOfBirth', v)}
              error={errors.placeOfBirth ?? null}
              disabled={wilayasQuery.isLoading || wilayaOptions.length === 0}
            />
            {wilayasQuery.isError && (
              <p className="mt-1 text-xs text-danger" role="alert">
                Failed to load wilayas.
              </p>
            )}
          </div>

          {saveError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg"
            >
              <AlertIcon size={14} />
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              variant="secondary"
              onClick={cancel}
              disabled={!isDirty || isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={!isDirty || !isValid || isSaving}
              loading={isSaving}
              iconLeft={isSaving ? <SpinnerIcon size={14} /> : undefined}
            >
              Save changes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
