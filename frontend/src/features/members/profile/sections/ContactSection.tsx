import { Card } from '../../../../components/ui';
import type { MemberProfile, ContactInfo, EmergencyContactInfo } from '../profileTypes';
import {
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
} from '../../../../components/ui/Icon';

interface ContactSectionProps {
  profile: MemberProfile;
}

function ContactCard({ contact }: { contact: ContactInfo }) {
  const label = contact.label ?? (contact.isPrimary ? 'Primary' : '');

  if (contact.type === 'phone') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <PhoneIcon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">{contact.value}</p>
          {label && <p className="text-xs text-neutral-500">{label}</p>}
        </div>
        <div className="flex gap-1.5">
          <a
            href={`tel:${contact.value}`}
            aria-label={`Call ${contact.value}`}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <PhoneIcon size={14} />
          </a>
          <a
            href={`sms:${contact.value}`}
            aria-label={`SMS ${contact.value}`}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-info-bg hover:text-info-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <MessageSquareIcon size={14} />
          </a>
          <a
            href={`https://wa.me/${contact.value.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${contact.value}`}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-success-bg hover:text-success-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <MessageSquareIcon size={14} />
          </a>
        </div>
      </div>
    );
  }

  if (contact.type === 'email') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-fg">
          <MailIcon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{contact.value}</p>
          {label && <p className="text-xs text-neutral-500">{label}</p>}
        </div>
        <a
          href={`mailto:${contact.value}`}
          aria-label={`Email ${contact.value}`}
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-info-bg hover:text-info-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <MailIcon size={14} />
        </a>
      </div>
    );
  }

  // address
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-fg">
        <MapPinIcon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{contact.value}</p>
        {label && <p className="text-xs text-neutral-500">{label}</p>}
      </div>
    </div>
  );
}

function EmergencyCard({ contact }: { contact: EmergencyContactInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning-bg p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning text-white">
        <PhoneIcon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{contact.name}</p>
        <p className="text-xs text-neutral-600">{contact.phone}</p>
        {contact.relationship && (
          <p className="text-xs text-neutral-500 capitalize">{contact.relationship}</p>
        )}
      </div>
      <a
        href={`tel:${contact.phone}`}
        aria-label={`Call ${contact.name}`}
        className="rounded-md p-1.5 text-warning-fg transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
      >
        <PhoneIcon size={14} />
      </a>
    </div>
  );
}

export function ContactSection({ profile }: ContactSectionProps) {
  const phones = profile.contacts.filter((c) => c.type === 'phone');
  const emails = profile.contacts.filter((c) => c.type === 'email');
  const addresses = profile.contacts.filter((c) => c.type === 'address');

  return (
    <section aria-labelledby="contact-heading" className="flex flex-col gap-4">
      <h2 id="contact-heading" className="sr-only">Contact Information</h2>

      {/* Phone Numbers */}
      {phones.length > 0 && (
        <Card title="Phone numbers">
          <ul className="flex flex-col gap-2">
            {phones.map((c) => (
              <li key={c.id}>
                <ContactCard contact={c} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Emails */}
      {emails.length > 0 && (
        <Card title="Email addresses">
          <ul className="flex flex-col gap-2">
            {emails.map((c) => (
              <li key={c.id}>
                <ContactCard contact={c} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Addresses */}
      {addresses.length > 0 && (
        <Card title="Addresses">
          <ul className="flex flex-col gap-2">
            {addresses.map((c) => (
              <li key={c.id}>
                <ContactCard contact={c} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Emergency Contacts */}
      <Card title="Emergency contacts">
        {profile.emergencyContacts.length === 0 ? (
          <p className="text-sm text-neutral-500">No emergency contacts on file.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.emergencyContacts.map((c) => (
              <li key={c.id}>
                <EmergencyCard contact={c} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {profile.contacts.length === 0 && profile.emergencyContacts.length === 0 && (
        <Card>
          <p className="text-center text-sm text-neutral-500">No contact information on file.</p>
        </Card>
      )}
    </section>
  );
}
