import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, DatePicker, Card } from '../../../../components/ui';
import { useWizard } from '../useWizard';
import {
  capitalizeWords,
  computeAge,
  isFutureDate,
  sanitizeArabicName,
  sanitizeLatinName,
  schoolLevelForAge,
} from '../../helpers/validators';
import {
  checkDuplicate,
  getWilayas,
  updateMember,
  type DuplicateMember,
  type Gender,
} from '../../api/membersApi';
import { queueMemberUpdate } from '../../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../../lib/offline-fallback';
import type { SelectOption } from '../../../../types/ui';
import { AlertIcon, UserIcon } from '../../../../components/ui/Icon';

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export function Step3Identity() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const baseId = useId();
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

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

  const [duplicates, setDuplicates] = useState<DuplicateMember[]>([]);
  const duplicateTimer = useRef<number | null>(null);
  const first = state.firstNameLatin.trim();
  const last = state.lastNameLatin.trim();
  const showDuplicates = first.length >= 2 && last.length >= 2 && duplicates.length > 0;
  useEffect(() => {
    if (duplicateTimer.current) window.clearTimeout(duplicateTimer.current);
    if (first.length < 2 || last.length < 2) {
      return;
    }
    duplicateTimer.current = window.setTimeout(async () => {
      try {
        const res = await checkDuplicate(first, last, 'latin');
        setDuplicates(res.duplicates ?? []);
      } catch {
        setDuplicates([]);
      }
    }, 500);
    return () => {
      if (duplicateTimer.current) window.clearTimeout(duplicateTimer.current);
    };
  }, [first, last]);

  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!state.firstNameLatin.trim()) {
      errors.firstNameLatin = 'First name (Latin) is required';
    }
    if (!state.lastNameLatin.trim()) {
      errors.lastNameLatin = 'Last name (Latin) is required';
    }
    if (!state.gender) {
      errors.gender = 'Gender is required';
    }
    if (!state.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else if (isFutureDate(state.dateOfBirth)) {
      errors.dateOfBirth = 'Date of birth cannot be in the future';
    }
    if (!state.wilayaCode) {
      errors.wilayaCode = 'Place of birth is required';
    }
    const ok = Object.keys(errors).length === 0;
    const firstInvalidFieldId = ok
      ? undefined
      : errors.firstNameLatin
        ? `${baseId}-first-latin`
        : errors.lastNameLatin
          ? `${baseId}-last-latin`
          : errors.gender
            ? `${baseId}-gender`
            : errors.dateOfBirth
              ? `${baseId}-dob`
              : `${baseId}-wilaya`;
    return { ok, errors, firstInvalidFieldId };
  }, [state, baseId]);

  useEffect(() => {
    notifyStepEvaluation('identity', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('identity', () => {
      setLocalErrors(validationResult.errors);
      return validationResult;
    });
  }, [validationResult, registerValidator]);

  const wilayasData = wilayasQuery.data;
  useEffect(() => {
    return registerAdvanceHandler('identity', async () => {
      if (!state.memberId) return false;
      const wilaya = wilayasData?.wilayas.find((w) => w.code === state.wilayaCode);
      const placeOfBirth = wilaya ? `${wilaya.code} - ${wilaya.nameLatin}` : null;
      const patch = {
        firstNameLatin: state.firstNameLatin.trim(),
        lastNameLatin: state.lastNameLatin.trim(),
        firstNameArabic: state.firstNameArabic.trim() || null,
        lastNameArabic: state.lastNameArabic.trim() || null,
        gender: state.gender ?? undefined,
        dateOfBirth: state.dateOfBirth ?? undefined,
        placeOfBirth,
      };
      const memberLabel = `${state.firstNameLatin.trim()} ${state.lastNameLatin.trim()}`.trim() || 'Member';
      const memberId = state.memberId;

      if (isOffline()) {
        await queueMemberUpdate({ memberId, memberLabel, patch });
        return true;
      }
      try {
        await updateMember(memberId, patch);
      } catch (err) {
        if (shouldFallbackOffline(err)) {
          await queueMemberUpdate({ memberId, memberLabel, patch });
          return true;
        }
        throw err;
      }
      return true;
    });
  }, [state, wilayasData, registerAdvanceHandler]);

  const age = state.dateOfBirth ? computeAge(state.dateOfBirth) : null;
  const schoolLevel = age != null ? schoolLevelForAge(age) : null;

  const errors = { ...validationResult.errors, ...localErrors };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Identity</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Name (Latin) is required. Arabic name is optional but recommended.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Name (Latin)
          </h3>
          <Input
            id={`${baseId}-first-latin`}
            label="First name"
            value={state.firstNameLatin}
            onChange={(e) => update({ firstNameLatin: sanitizeLatinName(e.target.value) })}
            onBlur={() => update({ firstNameLatin: capitalizeWords(state.firstNameLatin) })}
            maxLength={40}
            error={errors.firstNameLatin ?? null}
            autoComplete="given-name"
            direction="ltr"
          />
          <Input
            id={`${baseId}-last-latin`}
            label="Last name"
            value={state.lastNameLatin}
            onChange={(e) => update({ lastNameLatin: sanitizeLatinName(e.target.value) })}
            onBlur={() => update({ lastNameLatin: capitalizeWords(state.lastNameLatin) })}
            maxLength={40}
            error={errors.lastNameLatin ?? null}
            autoComplete="family-name"
            direction="ltr"
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Name (Arabic)
          </h3>
          <Input
            id={`${baseId}-first-arabic`}
            label="First name"
            value={state.firstNameArabic}
            onChange={(e) => update({ firstNameArabic: sanitizeArabicName(e.target.value) })}
            maxLength={40}
            direction="rtl"
          />
          <Input
            id={`${baseId}-last-arabic`}
            label="Last name"
            value={state.lastNameArabic}
            onChange={(e) => update({ lastNameArabic: sanitizeArabicName(e.target.value) })}
            maxLength={40}
            direction="rtl"
          />
        </section>
      </div>

      {showDuplicates && (
        <Card className="border-warning bg-warning-bg">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
              <AlertIcon size={16} />
              {duplicates.length} member{duplicates.length === 1 ? '' : 's'} with similar name
              found. Make sure this is not a duplicate.
            </div>
            <ul className="flex flex-col gap-2">
              {duplicates.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border border-warning/30 bg-white p-2 text-sm"
                >
                  {m.photoUrl ? (
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                      <UserIcon size={18} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">
                      {m.firstNameLatin} {m.lastNameLatin}
                    </div>
                    {(m.firstNameArabic || m.lastNameArabic) && (
                      <div className="font-arabic text-right text-xs text-neutral-500" dir="rtl">
                        {m.firstNameArabic ?? ''} {m.lastNameArabic ?? ''}
                      </div>
                    )}
                  </div>
                  {m.dateOfBirth && (
                    <div className="text-xs text-neutral-500">DOB: {m.dateOfBirth}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div id={`${baseId}-gender`}>
          <Select
            label="Gender"
            placeholder="Select gender"
            options={GENDER_OPTIONS}
            value={state.gender}
            onChange={(v) => update({ gender: v as Gender })}
            error={errors.gender ?? null}
          />
        </div>
        <div id={`${baseId}-dob`}>
          <DatePicker
            label="Date of birth"
            value={state.dateOfBirth}
            setValue={(iso) => update({ dateOfBirth: iso })}
            minYear={1930}
            error={errors.dateOfBirth ?? null}
          />
          {age != null && schoolLevel && (
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

      <div id={`${baseId}-wilaya`} className="max-w-md">
        <Select
          label="Place of birth"
          placeholder={wilayasQuery.isLoading ? 'Loading wilayas...' : 'Select wilaya'}
          options={wilayaOptions}
          value={state.wilayaCode}
          onChange={(v) => update({ wilayaCode: v })}
          error={errors.wilayaCode ?? null}
          disabled={wilayasQuery.isLoading || wilayaOptions.length === 0}
        />
        {wilayasQuery.isError && (
          <p className="mt-1 text-xs text-danger" role="alert">
            Failed to load wilayas. Retrying will help.
          </p>
        )}
      </div>
    </div>
  );
}
