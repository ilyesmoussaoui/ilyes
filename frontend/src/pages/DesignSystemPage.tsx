import { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  DatePicker,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  useToast,
} from '../components/ui';
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  SearchIcon,
} from '../components/ui/Icon';
import { useFieldValidation } from '../hooks/useFieldValidation';
import { formatPhone } from '../lib/format';
import type { BadgeVariant, SelectOption, TableColumn, ToastType } from '../types/ui';

interface DemoMember {
  id: string;
  name: string;
  arabic: string;
  discipline: string;
  status: BadgeVariant;
  payment: BadgeVariant;
  joined: string;
}

const DISCIPLINES_SHORT: SelectOption[] = [
  { value: 'taekwondo', label: 'Taekwondo' },
  { value: 'karate', label: 'Karate' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'judo', label: 'Judo' },
];

const DISCIPLINES_LONG: SelectOption[] = [
  { value: 'tkd', label: 'Taekwondo', group: 'Martial Arts' },
  { value: 'kar', label: 'Karate', group: 'Martial Arts' },
  { value: 'jdo', label: 'Judo', group: 'Martial Arts' },
  { value: 'box', label: 'Boxing', group: 'Martial Arts' },
  { value: 'mma', label: 'MMA', group: 'Martial Arts' },
  { value: 'bjj', label: 'Brazilian Jiu-Jitsu', group: 'Martial Arts' },
  { value: 'muy', label: 'Muay Thai', group: 'Martial Arts' },
  { value: 'crf', label: 'CrossFit', group: 'Fitness' },
  { value: 'yog', label: 'Yoga', group: 'Fitness' },
  { value: 'pil', label: 'Pilates', group: 'Fitness' },
  { value: 'zmb', label: 'Zumba', group: 'Fitness' },
];

const DEMO_MEMBERS: DemoMember[] = [
  { id: '1', name: 'Amine Bensalah', arabic: 'أمين بن صالح', discipline: 'Taekwondo', status: 'active', payment: 'paid', joined: '2024-01-12' },
  { id: '2', name: 'Yasmine Kaci', arabic: 'ياسمين قاسي', discipline: 'Karate', status: 'active', payment: 'partial', joined: '2024-02-03' },
  { id: '3', name: 'Omar Haddad', arabic: 'عمر حداد', discipline: 'Boxing', status: 'suspended', payment: 'unpaid', joined: '2023-11-28' },
  { id: '4', name: 'Lina Berkane', arabic: 'لينا بركان', discipline: 'Judo', status: 'expired', payment: 'unpaid', joined: '2023-08-14' },
  { id: '5', name: 'Karim Bouzid', arabic: 'كريم بوزيد', discipline: 'Taekwondo', status: 'pending', payment: 'pending', joined: '2024-03-19' },
  { id: '6', name: 'Rania Meziane', arabic: 'رانيا مزيان', discipline: 'MMA', status: 'active', payment: 'paid', joined: '2024-04-02' },
  { id: '7', name: 'Sami Touati', arabic: 'سامي توتي', discipline: 'Pilates', status: 'inactive', payment: 'paid', joined: '2023-06-01' },
  { id: '8', name: 'Hana Bouchra', arabic: 'هناء بشرى', discipline: 'Yoga', status: 'active', payment: 'paid', joined: '2024-01-22' },
  { id: '9', name: 'Nabil Chaker', arabic: 'نبيل شاكر', discipline: 'BJJ', status: 'active', payment: 'paid', joined: '2023-12-10' },
  { id: '10', name: 'Salima Fekir', arabic: 'سليمة فقير', discipline: 'Zumba', status: 'active', payment: 'partial', joined: '2024-02-28' },
  { id: '11', name: 'Walid Messaoudi', arabic: 'وليد مسعودي', discipline: 'Muay Thai', status: 'suspended', payment: 'unpaid', joined: '2023-09-17' },
  { id: '12', name: 'Meriem Tahar', arabic: 'مريم طاهر', discipline: 'Karate', status: 'active', payment: 'paid', joined: '2024-03-05' },
];

const ALL_BADGES: BadgeVariant[] = [
  'active',
  'inactive',
  'suspended',
  'expired',
  'pending',
  'paid',
  'partial',
  'unpaid',
];

const emailSchema = z.string().email('Please enter a valid email address');
const phoneSchema = z
  .string()
  .regex(/^(\d{4} \d{3} \d{3}|\d{10})$/, 'Enter 10 digits (e.g. 0555 123 456)');
const arabicSchema = z
  .string()
  .min(2, 'Please enter at least 2 characters')
  .regex(/[\u0600-\u06FF]/, 'Must contain Arabic characters');

export function DesignSystemPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [simpleDiscipline, setSimpleDiscipline] = useState<string>('taekwondo');
  const [longDiscipline, setLongDiscipline] = useState<string | null>('tkd');
  const [dob, setDob] = useState<string | null>('2000-06-15');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  const emailField = useFieldValidation('', emailSchema);
  const phoneField = useFieldValidation('', phoneSchema);
  const arabicField = useFieldValidation('', arabicSchema);

  const columns = useMemo<TableColumn<DemoMember>[]>(
    () => [
      {
        key: 'name',
        header: 'Member',
        sortable: true,
        accessor: (r) => (
          <div>
            <div className="font-medium text-neutral-900">{r.name}</div>
            <div className="font-arabic text-xs text-neutral-500" dir="rtl">
              {r.arabic}
            </div>
          </div>
        ),
      },
      { key: 'discipline', header: 'Discipline', sortable: true, accessor: (r) => r.discipline },
      { key: 'status', header: 'Status', sortable: true, accessor: (r) => <Badge variant={r.status} /> },
      { key: 'payment', header: 'Payment', sortable: true, accessor: (r) => <Badge variant={r.payment} /> },
      { key: 'joined', header: 'Joined', sortable: true, accessor: (r) => r.joined },
    ],
    [],
  );

  const fireToast = (type: ToastType) => {
    const TITLES: Record<ToastType, string> = {
      success: 'Saved successfully',
      error: 'Something went wrong',
      warning: 'Check the form',
      info: 'Heads up',
    };
    const DESCRIPTIONS: Record<ToastType, string> = {
      success: 'Your changes have been written to the server.',
      error: 'We could not save. Please try again.',
      warning: 'Some fields need your attention before continuing.',
      info: 'This page auto-refreshes every 30 seconds.',
    };
    toast.show({ type, title: TITLES[type], description: DESCRIPTIONS[type] });
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <header className="border-b border-neutral-200 bg-white shadow-elevation-1">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-500">Gym SaaS</p>
          <h1 className="mt-1 text-xl font-bold text-neutral-900">Design System — Part 1</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every shared UI primitive in every state. Frozen tech stack, locked tokens.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <Section id="tokens" title="Design tokens" description="Colors, spacing, typography and shadows.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card title="Primary palette">
              <div className="grid grid-cols-7 gap-2">
                {[50, 100, 200, 300, 400, 500, 600].map((shade) => (
                  <div key={shade} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-12 w-full rounded-md border border-neutral-200 bg-primary-${shade}`}
                      aria-hidden
                    />
                    <span className="text-xs text-neutral-500">{shade}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Neutral palette">
              <div className="grid grid-cols-10 gap-2">
                {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                  <div key={shade} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-12 w-full rounded-md border border-neutral-200 bg-neutral-${shade}`}
                      aria-hidden
                    />
                    <span className="text-[10px] text-neutral-500">{shade}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Semantic colors">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { name: 'success', className: 'bg-success' },
                  { name: 'danger', className: 'bg-danger' },
                  { name: 'warning', className: 'bg-warning' },
                  { name: 'info', className: 'bg-info' },
                ].map((item) => (
                  <div key={item.name} className="flex flex-col items-center gap-1">
                    <div className={`h-12 w-full rounded-md ${item.className}`} aria-hidden />
                    <span className="text-xs text-neutral-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Shadows &amp; radii">
              <div className="grid grid-cols-4 gap-3">
                {([1, 2, 3] as const).map((n) => (
                  <div key={n} className="flex flex-col items-center gap-2">
                    <div className={`h-14 w-full rounded-md bg-white shadow-elevation-${n}`} aria-hidden />
                    <span className="text-xs text-neutral-500">elevation-{n}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-full rounded-full bg-primary-100" aria-hidden />
                  <span className="text-xs text-neutral-500">radius-full</span>
                </div>
              </div>
            </Card>
            <Card title="Typography (Latin)">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">xs · 12 — The quick brown fox</p>
                <p className="text-sm text-neutral-600">sm · 14 — The quick brown fox</p>
                <p className="text-base text-neutral-700">base · 16 — The quick brown fox</p>
                <p className="text-lg text-neutral-800">lg · 20 — The quick brown fox</p>
                <p className="text-xl font-semibold text-neutral-900">xl · 24 — The quick brown fox</p>
              </div>
            </Card>
            <Card title="Typography (Arabic)">
              <div className="space-y-2 text-right font-arabic" dir="rtl">
                <p className="text-xs text-neutral-500">١٢ — الثعلب البني السريع</p>
                <p className="text-sm text-neutral-600">١٤ — الثعلب البني السريع</p>
                <p className="text-base text-neutral-700">١٦ — الثعلب البني السريع</p>
                <p className="text-lg text-neutral-800">٢٠ — الثعلب البني السريع</p>
                <p className="text-xl font-semibold text-neutral-900">٢٤ — الثعلب البني السريع</p>
              </div>
            </Card>
          </div>
        </Section>

        <Section id="buttons" title="Button" description="5 variants, 2 sizes, loading and icon states.">
          <Card>
            <div className="space-y-6">
              <div>
                <Label>Variants — default size (40px)</Label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="disabled">Disabled</Button>
                </div>
              </div>
              <div>
                <Label>Touch size (48px)</Label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" size="touch">
                    Primary
                  </Button>
                  <Button variant="secondary" size="touch">
                    Secondary
                  </Button>
                  <Button variant="danger" size="touch">
                    Danger
                  </Button>
                </div>
              </div>
              <div>
                <Label>States — loading, icons, disabled</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button loading>Saving…</Button>
                  <Button iconLeft={<PlusIcon size={16} />}>Add member</Button>
                  <Button variant="secondary" iconRight={<CheckIcon size={16} />}>
                    Confirm
                  </Button>
                  <Button variant="danger" iconLeft={<TrashIcon size={16} />}>
                    Delete
                  </Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        <Section id="inputs" title="Input" description="Label, validation, icons, multi-script.">
          <Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Email address"
                type="email"
                placeholder="member@gym.dz"
                value={emailField.value}
                error={emailField.isDirty ? emailField.error : null}
                isValid={emailField.isValid}
                onChange={(e) => emailField.onChange(e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="0555 123 456"
                value={phoneField.value}
                error={phoneField.isDirty ? phoneField.error : null}
                isValid={phoneField.isValid}
                onChange={(e) => phoneField.onChange(e.target.value)}
              />
              <Input
                label="Phone (auto-format preview)"
                placeholder="0555 123 456"
                value={phoneDisplay}
                onChange={(e) => setPhoneDisplay(formatPhone(e.target.value))}
                helperText="Digits only — formatted as you type."
              />
              <Input
                label="الاسم الكامل"
                placeholder="أدخل الاسم بالعربية"
                direction="rtl"
                value={arabicField.value}
                error={arabicField.isDirty ? arabicField.error : null}
                isValid={arabicField.isValid}
                onChange={(e) => arabicField.onChange(e.target.value)}
              />
              <Input label="Disabled" value="Locked" disabled readOnly />
              <Input label="With icon" iconLeft={<SearchIcon size={16} />} placeholder="Search members" />
            </div>
          </Card>
        </Section>

        <Section id="select-date" title="Select & DatePicker" description="Native and searchable, and the three-dropdown date picker.">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Select — native (<8)">
              <Select
                label="Discipline"
                options={DISCIPLINES_SHORT}
                value={simpleDiscipline}
                onChange={setSimpleDiscipline}
              />
              <p className="mt-3 text-xs text-neutral-500">Value: {simpleDiscipline || '—'}</p>
            </Card>
            <Card title="Select — searchable combobox (>=8)">
              <Select
                label="Discipline (grouped)"
                options={DISCIPLINES_LONG}
                value={longDiscipline}
                onChange={setLongDiscipline}
                placeholder="Search disciplines..."
              />
              <p className="mt-3 text-xs text-neutral-500">Value: {longDiscipline || '—'}</p>
            </Card>
            <Card title="DatePicker — three dropdowns">
              <DatePicker label="Date of birth" value={dob} setValue={setDob} />
              <p className="mt-3 text-xs text-neutral-500">ISO: {dob ?? '—'}</p>
              {dob && <p className="text-xs text-neutral-500">Age: {computeAge(dob)} years</p>}
            </Card>
            <Card title="DatePicker — disabled">
              <DatePicker label="Joined on" value="2023-11-18" setValue={() => undefined} disabled />
            </Card>
          </div>
        </Section>

        <Section id="badges" title="Badge" description="8 status variants — each with icon, label and color.">
          <Card>
            <div className="flex flex-wrap gap-3">
              {ALL_BADGES.map((v) => (
                <Badge key={v} variant={v} />
              ))}
            </div>
          </Card>
        </Section>

        <Section id="cards" title="Card" description="With header, action, hover variant.">
          <div className="grid gap-6 md:grid-cols-3">
            <Card title="Standard card">
              <p className="text-sm text-neutral-600">Simple card with padding and a header title.</p>
            </Card>
            <Card
              title="With action"
              action={
                <Button size="default" variant="secondary">
                  Edit
                </Button>
              }
            >
              <p className="text-sm text-neutral-600">Actions sit in the header, aligned right.</p>
            </Card>
            <Card hover title="Hoverable">
              <p className="text-sm text-neutral-600">Raises on hover for interactive lists.</p>
            </Card>
          </div>
        </Section>

        <Section id="modals" title="Modal & Toast" description="Focus trap, Escape close, and stacked toasts.">
          <Card>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Open confirm modal
              </Button>
              <Button variant="secondary" onClick={() => fireToast('success')}>
                Toast · success
              </Button>
              <Button variant="secondary" onClick={() => fireToast('error')}>
                Toast · error
              </Button>
              <Button variant="secondary" onClick={() => fireToast('warning')}>
                Toast · warning
              </Button>
              <Button variant="secondary" onClick={() => fireToast('info')}>
                Toast · info
              </Button>
            </div>
          </Card>
        </Section>

        <Section id="tables" title="Table" description="Sorting, pagination, empty and skeleton states.">
          <Card
            title="Members"
            action={
              <Button variant="secondary" onClick={() => setLoadingTable((v) => !v)}>
                {loadingTable ? 'Show data' : 'Show skeleton'}
              </Button>
            }
          >
            <Table
              columns={columns}
              data={DEMO_MEMBERS}
              getRowId={(r) => r.id}
              loading={loadingTable}
              pageSize={5}
            />
          </Card>
          <div className="mt-6">
            <Card title="Empty state">
              <Table
                columns={columns}
                data={[]}
                getRowId={(r) => r.id}
                emptyTitle="No members yet"
                emptyMessage="Create your first member to see them listed here."
              />
            </Card>
          </div>
        </Section>

        <Section id="skeletons" title="Skeleton" description="Text, avatar, card and row variants.">
          <div className="grid gap-6 md:grid-cols-4">
            <Card title="Text">
              <Skeleton variant="text" lines={3} />
            </Card>
            <Card title="Avatar">
              <div className="flex items-center gap-3">
                <Skeleton variant="avatar" />
                <div className="flex-1">
                  <Skeleton variant="text" lines={2} />
                </div>
              </div>
            </Card>
            <Card title="Card">
              <Skeleton variant="card" />
            </Card>
            <Card title="Row">
              <Skeleton variant="row" />
              <Skeleton variant="row" />
              <Skeleton variant="row" />
            </Card>
          </div>
        </Section>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Enroll a new member"
        description="Fill in the basics — you can edit later."
      >
        <div className="space-y-4">
          <Input label="Full name (Latin)" placeholder="Amine Bensalah" />
          <Input label="Full name (Arabic)" placeholder="أمين بن صالح" direction="rtl" />
          <Select label="Discipline" options={DISCIPLINES_SHORT} value={simpleDiscipline} onChange={setSimpleDiscipline} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setModalOpen(false);
              toast.show({ type: 'success', title: 'Member added', description: 'Your member is now active.' });
            }}
          >
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.show({ type: 'error', title: 'Member deleted', description: 'Use the audit log to restore if needed.' });
        }}
        title="Delete this member?"
        message="This will soft-delete the record. You can restore it from the audit log within 30 days."
        confirmLabel="Delete"
      />
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        {description && <p className="text-sm text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</p>;
}

function computeAge(iso: string): number {
  const dob = new Date(iso);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
