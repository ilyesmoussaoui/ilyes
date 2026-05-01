import { useMemo, useEffect, useRef } from 'react';
import { Input, Select, Button, Card } from '../../../../components/ui';
import { TrashIcon, PlusIcon, AlertIcon } from '../../../../components/ui/Icon';
import { useEditForm } from '../useEditForm';
import type { ContactFormState } from '../editTypes';
import type { MemberProfile } from '../../profile/profileTypes';
import { updateMemberContacts } from '../editApi';
import { queueMemberUpdate } from '../../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../../lib/offline-fallback';
import {
  formatAlgerianPhone,
  isValidAlgerianPhone,
  isValidEmail,
  MAX_ADDRESS_LENGTH,
  phoneDigits,
  sanitizeEmailInput,
} from '../../helpers/validators';
import type { SelectOption } from '../../../../types/ui';
import { useToast } from '../../../../components/ui/Toast';

interface ContactTabProps {
  profile: MemberProfile;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const RELATIONSHIP_OPTIONS: SelectOption[] = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function profileToContactState(profile: MemberProfile): ContactFormState {
  const phones = profile.contacts
    .filter((c) => c.type === 'phone')
    .map((c) => ({
      id: c.id,
      value: formatAlgerianPhone(c.value),
    }));

  const emails = profile.contacts
    .filter((c) => c.type === 'email')
    .map((c) => ({ id: c.id, value: c.value }));

  const addressContact = profile.contacts.find((c) => c.type === 'address');
  const address = addressContact?.value ?? '';

  const emergencyContacts = profile.emergencyContacts.map((ec) => ({
    id: ec.id,
    name: ec.name,
    phone: formatAlgerianPhone(ec.phone),
    relationship: ec.relationship ?? '',
  }));

  return {
    phones: phones.length > 0 ? phones : [{ id: nextId('p'), value: '' }],
    emails,
    address,
    emergencyContacts,
  };
}

function validateContact(data: ContactFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  const validPhones = data.phones.filter((p) => isValidAlgerianPhone(p.value));
  if (validPhones.length === 0) {
    errors.phones = 'At least one valid phone is required';
  }
  data.phones.forEach((p, i) => {
    if (p.value && !isValidAlgerianPhone(p.value)) {
      errors[`phone-${i}`] =
        'Phone must be 10 digits starting with 05, 06, or 07';
    }
  });
  data.emails.forEach((em, i) => {
    if (em.value && !isValidEmail(em.value)) {
      errors[`email-${i}`] = 'Enter a valid email address';
    }
  });
  data.emergencyContacts.forEach((ec, i) => {
    if (ec.name || ec.phone || ec.relationship) {
      if (!ec.name.trim()) errors[`ec-name-${i}`] = 'Name is required';
      if (!isValidAlgerianPhone(ec.phone))
        errors[`ec-phone-${i}`] = 'Valid phone required';
      if (!ec.relationship) errors[`ec-rel-${i}`] = 'Relationship is required';
    }
  });
  if (data.address.length > MAX_ADDRESS_LENGTH) {
    errors.address = `Address must be at most ${MAX_ADDRESS_LENGTH} characters`;
  }

  return errors;
}

export function ContactTab({
  profile,
  onSaved,
  onDirtyChange,
}: ContactTabProps) {
  const { showToast } = useToast();
  const initialData = useMemo(() => profileToContactState(profile), [profile]);
  const queuedOfflineRef = useRef(false);

  const {
    formData,
    setField,
    errors,
    isDirty,
    isValid,
    isSaving,
    saveError,
    save,
    cancel,
  } = useEditForm<ContactFormState>({
    initialData,
    onSave: async (data) => {
      const contacts: Array<{
        type: 'phone' | 'email' | 'address';
        value: string;
        isPrimary?: boolean;
      }> = [];

      const validPhones = data.phones.filter((p) =>
        isValidAlgerianPhone(p.value),
      );
      validPhones.forEach((p, i) =>
        contacts.push({
          type: 'phone',
          value: phoneDigits(p.value),
          isPrimary: i === 0,
        }),
      );

      const validEmails = data.emails.filter((e) => isValidEmail(e.value));
      validEmails.forEach((e, i) =>
        contacts.push({ type: 'email', value: e.value, isPrimary: i === 0 }),
      );

      if (data.address.trim()) {
        contacts.push({
          type: 'address',
          value: data.address.trim(),
          isPrimary: true,
        });
      }

      const emergencyContacts = data.emergencyContacts
        .filter(
          (ec) =>
            ec.name.trim() && isValidAlgerianPhone(ec.phone) && ec.relationship,
        )
        .map((ec) => ({
          name: ec.name.trim(),
          phone: phoneDigits(ec.phone),
          relationship: ec.relationship,
        }));

      const patch = { contacts, emergencyContacts };
      const memberLabel = `${profile.firstNameLatin ?? ''} ${profile.lastNameLatin ?? ''}`.trim() || 'Member';

      queuedOfflineRef.current = false;
      if (isOffline()) {
        await queueMemberUpdate({ memberId: profile.id, memberLabel, patch });
        queuedOfflineRef.current = true;
        return;
      }
      try {
        await updateMemberContacts(profile.id, patch);
      } catch (err) {
        if (shouldFallbackOffline(err)) {
          await queueMemberUpdate({ memberId: profile.id, memberLabel, patch });
          queuedOfflineRef.current = true;
          return;
        }
        throw err;
      }
    },
    validate: validateContact,
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
              description: 'Contact info will sync when the connection returns.',
            }
          : { type: 'success', title: 'Contact info saved' },
      );
      onSaved();
      onDirtyChange(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-8">
          {/* Phones */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Phones
            </h3>
            <div className="flex flex-col gap-3">
              {formData.phones.map((phone, i) => (
                <div key={phone.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={phone.value}
                      onChange={(e) => {
                        const next = [...formData.phones];
                        next[i] = {
                          ...phone,
                          value: formatAlgerianPhone(e.target.value),
                        };
                        setField('phones', next);
                      }}
                      placeholder="05 12 34 56 78"
                      inputMode="tel"
                      maxLength={14}
                      error={errors[`phone-${i}`] ?? null}
                    />
                  </div>
                  {formData.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setField(
                          'phones',
                          formData.phones.filter((_, idx) => idx !== i),
                        )
                      }
                      className="mt-1 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      aria-label={`Remove phone ${i + 1}`}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.phones && (
              <p className="text-xs text-danger" role="alert">
                {errors.phones}
              </p>
            )}
            <Button
              variant="ghost"
              iconLeft={<PlusIcon size={14} />}
              onClick={() =>
                setField('phones', [
                  ...formData.phones,
                  { id: nextId('p'), value: '' },
                ])
              }
            >
              Add phone
            </Button>
          </section>

          {/* Emails */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Emails
            </h3>
            {formData.emails.length === 0 && (
              <p className="text-xs text-neutral-500">No emails added.</p>
            )}
            <div className="flex flex-col gap-3">
              {formData.emails.map((email, i) => (
                <div key={email.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={email.value}
                      onChange={(e) => {
                        const next = [...formData.emails];
                        next[i] = {
                          ...email,
                          value: sanitizeEmailInput(e.target.value),
                        };
                        setField('emails', next);
                      }}
                      placeholder="name@example.com"
                      error={errors[`email-${i}`] ?? null}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setField(
                        'emails',
                        formData.emails.filter((_, idx) => idx !== i),
                      )
                    }
                    className="mt-1 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    aria-label={`Remove email ${i + 1}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              iconLeft={<PlusIcon size={14} />}
              onClick={() =>
                setField('emails', [
                  ...formData.emails,
                  { id: nextId('e'), value: '' },
                ])
              }
            >
              Add email
            </Button>
          </section>

          {/* Address */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Address
            </h3>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="edit-address"
                className="text-sm font-medium text-neutral-700"
              >
                Address
              </label>
              <textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) =>
                  setField(
                    'address',
                    e.target.value.slice(0, MAX_ADDRESS_LENGTH),
                  )
                }
                rows={3}
                maxLength={MAX_ADDRESS_LENGTH}
                placeholder="Street, city..."
                className="w-full rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <p className="text-xs text-neutral-500">
                {formData.address.length}/{MAX_ADDRESS_LENGTH}
              </p>
              {errors.address && (
                <p className="text-xs text-danger" role="alert">
                  {errors.address}
                </p>
              )}
            </div>
          </section>

          {/* Emergency contacts */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Emergency contacts
            </h3>
            {formData.emergencyContacts.length === 0 && (
              <p className="text-xs text-neutral-500">
                No emergency contacts added.
              </p>
            )}
            <div className="flex flex-col gap-4">
              {formData.emergencyContacts.map((ec, i) => (
                <div
                  key={ec.id}
                  className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Name"
                      value={ec.name}
                      onChange={(e) => {
                        const next = [...formData.emergencyContacts];
                        next[i] = { ...ec, name: e.target.value };
                        setField('emergencyContacts', next);
                      }}
                      error={errors[`ec-name-${i}`] ?? null}
                    />
                    <Input
                      label="Phone"
                      value={ec.phone}
                      onChange={(e) => {
                        const next = [...formData.emergencyContacts];
                        next[i] = {
                          ...ec,
                          phone: formatAlgerianPhone(e.target.value),
                        };
                        setField('emergencyContacts', next);
                      }}
                      inputMode="tel"
                      maxLength={14}
                      error={errors[`ec-phone-${i}`] ?? null}
                    />
                    <Select
                      label="Relationship"
                      options={RELATIONSHIP_OPTIONS}
                      value={ec.relationship || null}
                      onChange={(v) => {
                        const next = [...formData.emergencyContacts];
                        next[i] = { ...ec, relationship: v };
                        setField('emergencyContacts', next);
                      }}
                      error={errors[`ec-rel-${i}`] ?? null}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setField(
                          'emergencyContacts',
                          formData.emergencyContacts.filter(
                            (_, idx) => idx !== i,
                          ),
                        )
                      }
                      iconLeft={<TrashIcon size={14} />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              iconLeft={<PlusIcon size={14} />}
              onClick={() =>
                setField('emergencyContacts', [
                  ...formData.emergencyContacts,
                  { id: nextId('ec'), name: '', phone: '', relationship: '' },
                ])
              }
            >
              Add emergency contact
            </Button>
          </section>

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
            >
              Save changes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
