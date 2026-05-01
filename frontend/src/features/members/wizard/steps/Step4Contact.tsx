import { useEffect, useId, useMemo } from 'react';
import { Input, Select, Button } from '../../../../components/ui';
import { TrashIcon, PlusIcon } from '../../../../components/ui/Icon';
import { useWizard } from '../useWizard';
import {
  formatAlgerianPhone,
  isValidAlgerianPhone,
  isValidEmail,
  MAX_ADDRESS_LENGTH,
  phoneDigits,
  sanitizeEmailInput,
} from '../../helpers/validators';
import { updateMember, type MemberContact } from '../../api/membersApi';
import type { PhoneEntry, EmailEntry, EmergencyContactEntry } from '../wizardTypes';
import type { SelectOption } from '../../../../types/ui';
import { queueMemberUpdate } from '../../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../../lib/offline-fallback';

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

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function Step4Contact() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const baseId = useId();

  const phones = state.phones;
  const emails = state.emails;
  const emergencyContacts = state.emergencyContacts;

  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    const validPhones = phones.filter((p) => isValidAlgerianPhone(p.value));
    if (validPhones.length === 0) {
      errors.phones = 'At least one valid phone is required';
    }
    phones.forEach((p, i) => {
      if (p.value && !isValidAlgerianPhone(p.value)) {
        errors[`phone-${i}`] = 'Phone must be 10 digits starting with 05, 06, or 07';
      }
    });
    emails.forEach((em, i) => {
      if (em.value && !isValidEmail(em.value)) {
        errors[`email-${i}`] = 'Enter a valid email address';
      }
    });
    emergencyContacts.forEach((ec, i) => {
      if (ec.name || ec.phone || ec.relationship) {
        if (!ec.name.trim()) errors[`ec-name-${i}`] = 'Name is required';
        if (!isValidAlgerianPhone(ec.phone))
          errors[`ec-phone-${i}`] = 'Valid phone required';
        if (!ec.relationship) errors[`ec-rel-${i}`] = 'Relationship is required';
      }
    });
    if (state.address.length > MAX_ADDRESS_LENGTH) {
      errors.address = `Address must be at most ${MAX_ADDRESS_LENGTH} characters`;
    }
    const ok = Object.keys(errors).length === 0;
    return {
      ok,
      errors,
      firstInvalidFieldId: ok ? undefined : `${baseId}-phone-0`,
    };
  }, [phones, emails, emergencyContacts, state.address, baseId]);

  useEffect(() => {
    notifyStepEvaluation('contact', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('contact', () => validationResult);
  }, [validationResult, registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('contact', async () => {
      if (!state.memberId) return false;
      const contacts: MemberContact[] = [];
      const validPhones = phones.filter((p) => isValidAlgerianPhone(p.value));
      validPhones.forEach((p, i) =>
        contacts.push({
          type: 'phone',
          value: phoneDigits(p.value),
          isPrimary: i === 0,
        }),
      );
      const validEmails = emails.filter((e) => isValidEmail(e.value));
      validEmails.forEach((e, i) =>
        contacts.push({
          type: 'email',
          value: e.value,
          isPrimary: i === 0,
        }),
      );
      if (state.address.trim()) {
        contacts.push({
          type: 'address',
          value: state.address.trim(),
          isPrimary: true,
        });
      }
      const emergency = emergencyContacts
        .filter(
          (ec) => ec.name.trim() && isValidAlgerianPhone(ec.phone) && ec.relationship,
        )
        .map((ec) => ({
          name: ec.name.trim(),
          phone: phoneDigits(ec.phone),
          relationship: ec.relationship,
        }));
      const patch = { contacts, emergencyContacts: emergency };
      const memberId = state.memberId;
      const memberLabel = 'Member contacts';

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
  }, [state.memberId, phones, emails, emergencyContacts, state.address, registerAdvanceHandler]);

  const setPhones = (next: PhoneEntry[]) => update({ phones: next });
  const setEmails = (next: EmailEntry[]) => update({ emails: next });
  const setEmergency = (next: EmergencyContactEntry[]) =>
    update({ emergencyContacts: next });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Contact information</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add at least one phone number. Emails and address are optional.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Phones
        </h3>
        <div className="flex flex-col gap-3">
          {phones.map((phone, i) => {
            const err = validationResult.errors[`phone-${i}`];
            return (
              <div key={phone.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    id={i === 0 ? `${baseId}-phone-0` : undefined}
                    value={phone.value}
                    onChange={(e) => {
                      const formatted = formatAlgerianPhone(e.target.value);
                      const next = phones.slice();
                      next[i] = { ...phone, value: formatted };
                      setPhones(next);
                    }}
                    placeholder="05 12 34 56 78"
                    inputMode="tel"
                    maxLength={14}
                    error={err ?? null}
                  />
                </div>
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}
                    className="mt-1 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
                    aria-label={`Remove phone ${i + 1}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {validationResult.errors.phones && (
          <p className="text-xs text-danger" role="alert">
            {validationResult.errors.phones}
          </p>
        )}
        <Button
          variant="ghost"
          iconLeft={<PlusIcon size={14} />}
          onClick={() => setPhones([...phones, { id: nextId('p'), value: '' }])}
        >
          Add phone
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Emails
        </h3>
        {emails.length === 0 && (
          <p className="text-xs text-neutral-500">No emails added.</p>
        )}
        <div className="flex flex-col gap-3">
          {emails.map((email, i) => (
            <div key={email.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  value={email.value}
                  onChange={(e) => {
                    const next = emails.slice();
                    next[i] = { ...email, value: sanitizeEmailInput(e.target.value) };
                    setEmails(next);
                  }}
                  placeholder="name@example.com"
                  error={validationResult.errors[`email-${i}`] ?? null}
                />
              </div>
              <button
                type="button"
                onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}
                className="mt-1 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
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
          onClick={() => setEmails([...emails, { id: nextId('e'), value: '' }])}
        >
          Add email
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Address
        </h3>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-address`} className="sr-only">
            Address
          </label>
          <textarea
            id={`${baseId}-address`}
            value={state.address}
            onChange={(e) =>
              update({ address: e.target.value.slice(0, MAX_ADDRESS_LENGTH) })
            }
            rows={3}
            maxLength={MAX_ADDRESS_LENGTH}
            placeholder="Street, city..."
            className="w-full rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <p className="text-xs text-neutral-500">
            {state.address.length}/{MAX_ADDRESS_LENGTH}
          </p>
          {validationResult.errors.address && (
            <p className="text-xs text-danger" role="alert">
              {validationResult.errors.address}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Emergency contacts
        </h3>
        {emergencyContacts.length === 0 && (
          <p className="text-xs text-neutral-500">No emergency contacts added.</p>
        )}
        <div className="flex flex-col gap-4">
          {emergencyContacts.map((ec, i) => (
            <div
              key={ec.id}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  label="Name"
                  value={ec.name}
                  onChange={(e) => {
                    const next = emergencyContacts.slice();
                    next[i] = { ...ec, name: e.target.value };
                    setEmergency(next);
                  }}
                  error={validationResult.errors[`ec-name-${i}`] ?? null}
                />
                <Input
                  label="Phone"
                  value={ec.phone}
                  onChange={(e) => {
                    const next = emergencyContacts.slice();
                    next[i] = { ...ec, phone: formatAlgerianPhone(e.target.value) };
                    setEmergency(next);
                  }}
                  inputMode="tel"
                  maxLength={14}
                  error={validationResult.errors[`ec-phone-${i}`] ?? null}
                />
                <Select
                  label="Relationship"
                  options={RELATIONSHIP_OPTIONS}
                  value={ec.relationship || null}
                  onChange={(v) => {
                    const next = emergencyContacts.slice();
                    next[i] = { ...ec, relationship: v };
                    setEmergency(next);
                  }}
                  error={validationResult.errors[`ec-rel-${i}`] ?? null}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEmergency(emergencyContacts.filter((_, idx) => idx !== i))
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
            setEmergency([
              ...emergencyContacts,
              { id: nextId('ec'), name: '', phone: '', relationship: '' },
            ])
          }
        >
          Add emergency contact
        </Button>
      </section>
    </div>
  );
}
