import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  ErrorState,
} from '../../../components/ui';
import { useToast } from '../../../components/ui';
import {
  EditIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon,
  FingerprintIcon,
  UserIcon,
  CalendarIcon,
  XIcon,
} from '../../../components/ui/Icon';
import type { TableColumn } from '../../../types/ui';
import type { BadgeVariant } from '../../../types/ui';
import type { AttendanceLogRecord, AttendanceAuditEntry } from '../attendanceApi';
import {
  getAttendanceLogs,
  exportAttendanceLogs,
  updateAttendance,
  deleteAttendance,
  getAttendanceHistory,
} from '../attendanceApi';
import { getDisciplines, searchMembers } from '../../members/api/membersApi';
import type { Discipline } from '../../members/api/membersApi';
import { useAuthStore } from '../../auth/authStore';

/* ──────────────────── Icon helpers (inline SVG for missing icons) ──────────────────── */

function ScanBarcodeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M3 19v2" />
      <path d="M21 19v2" />
      <path d="M3 9v6" />
      <path d="M21 9v6" />
      <line x1="9" y1="5" x2="9" y2="19" />
      <line x1="13" y1="5" x2="13" y2="19" />
      <line x1="17" y1="5" x2="17" y2="19" />
    </svg>
  );
}

function MonitorSmallIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function HistorySmallIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

/* ──────────────────── Date range chips ──────────────────── */

type DateRangePreset = 'today' | '7d' | 'month' | 'custom';

function getPresetDates(preset: DateRangePreset): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    const s = fmt(now);
    return { start: s, end: s };
  }
  if (preset === '7d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: fmt(start), end: fmt(now) };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(start), end: fmt(now) };
  }
  return { start: '', end: '' };
}

/* ──────────────────── Format helpers ──────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return '---';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return '---';
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '<1m';
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours === 0) return `${remainMins}m`;
  if (remainMins === 0) return `${hours}h`;
  return `${hours}h ${remainMins}m`;
}

function formatDateForInput(iso: string): string {
  return iso.slice(0, 16);
}

function methodBadge(method: string): BadgeVariant {
  switch (method) {
    case 'face':
      return 'active';
    case 'barcode':
      return 'pending';
    default:
      return 'inactive';
  }
}

function methodLabel(method: string): string {
  switch (method) {
    case 'face':
      return 'Reconnaissance';
    case 'barcode':
      return 'Code-barres';
    case 'manual':
      return 'Manuel';
    default:
      return method;
  }
}

function MethodIcon({ method, size = 13 }: { method: string; size?: number }) {
  if (method === 'face') return <FingerprintIcon size={size} />;
  if (method === 'barcode') return <ScanBarcodeIcon size={size} />;
  return <UserIcon size={size} />;
}

function statusBadge(status: string): BadgeVariant {
  return status === 'present' ? 'active' : 'inactive';
}

function statusLabel(status: string): string {
  return status === 'present' ? 'Arrivé' : 'Départ';
}

/* ──────────────────── CSV export ──────────────────── */

function recordsToCsv(records: AttendanceLogRecord[]): string {
  const headers = [
    'Date',
    'Heure',
    'Membre',
    'Discipline',
    'Méthode',
    'Appareil',
    'Statut',
    'Durée',
    'Notes',
    'Intervenant',
  ];

  const escape = (v: string | null | undefined) => {
    const s = v ?? '';
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map((r) =>
    [
      escape(formatDate(r.checkInTime)),
      escape(formatTime(r.checkInTime)),
      escape(`${r.member.firstNameLatin} ${r.member.lastNameLatin}`),
      escape(r.discipline?.name ?? ''),
      escape(methodLabel(r.method)),
      escape(r.device ?? ''),
      escape(statusLabel(r.status)),
      escape(formatDuration(r.checkInTime, r.checkOutTime)),
      escape(r.notes ?? ''),
      escape(r.operator?.fullNameLatin ?? ''),
    ].join(','),
  );

  return [headers.join(','), ...rows].join('\r\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ──────────────────── Member combobox ──────────────────── */

interface MemberOption {
  id: string;
  label: string;
}

function MemberCombobox({
  value,
  onChange,
}: {
  value: MemberOption | null;
  onChange: (v: MemberOption | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchMembers(query.trim());
        setOptions(
          res.members.map((m) => ({
            id: m.id,
            label: `${m.firstNameLatin} ${m.lastNameLatin}`,
          })),
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (opt: MemberOption) => {
    onChange(opt);
    setQuery(opt.label);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setOptions([]);
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 lg:max-w-[220px]">
      <label className="mb-1 block text-sm font-medium text-neutral-700">Membre</label>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          placeholder="Rechercher..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onChange(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-10 w-full rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-8 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        {value && (
          <button
            type="button"
            aria-label="Effacer la sélection"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center text-neutral-400 hover:text-neutral-700"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      {open && (query.trim().length > 0) && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-elevation-2 text-sm"
        >
          {loading && (
            <li className="px-3 py-2 text-neutral-500">Recherche...</li>
          )}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-neutral-500">Aucun résultat</li>
          )}
          {!loading &&
            options.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={value?.id === opt.id}
                onClick={() => handleSelect(opt)}
                className="cursor-pointer px-3 py-2 hover:bg-primary-50 text-neutral-800"
              >
                {opt.label}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/* ──────────────────── Audit Drawer ──────────────────── */

function AuditDrawer({
  record,
  onClose,
}: {
  record: AttendanceLogRecord | null;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<AttendanceAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStub, setIsStub] = useState(false);

  useEffect(() => {
    if (!record) return;
    setLoading(true);
    setIsStub(false);
    setEntries([]);
    getAttendanceHistory(record.id)
      .then((res) => {
        setEntries(res.entries);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.message === 'STUB') {
          setIsStub(true);
        }
        setLoading(false);
      });
  }, [record]);

  if (!record) return null;

  return (
    <Modal
      open={record !== null}
      onClose={onClose}
      title={`Historique — ${record.member.firstNameLatin} ${record.member.lastNameLatin}`}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <CalendarIcon size={14} />
          <span>
            Enregistrement du {formatDate(record.checkInTime)} à {formatTime(record.checkInTime)}
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
          </div>
        )}

        {!loading && isStub && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 py-10 text-center">
            <HistorySmallIcon size={28} />
            <p className="text-sm font-medium text-neutral-600">Audit endpoint en attente</p>
            <p className="text-xs text-neutral-400">
              TODO (Phase 3) : implémenter{' '}
              <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono">
                GET /attendance/:id/history
              </code>
            </p>
          </div>
        )}

        {!loading && !isStub && entries.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">
            Aucune modification enregistrée.
          </p>
        )}

        {!loading && !isStub && entries.length > 0 && (
          <ol className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <li
                key={i}
                className="rounded-md border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-neutral-800">{entry.fieldName}</span>
                  <span className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="line-through text-neutral-400">{entry.oldValue ?? '—'}</span>
                  <span>→</span>
                  <span>{entry.newValue ?? '—'}</span>
                </div>
                {entry.reason && (
                  <p className="mt-1 text-xs text-neutral-500 italic">
                    Motif : {entry.reason}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-neutral-400">Par {entry.userName}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────── Main Component ──────────────────── */

export function AttendanceLog() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const toast = useToast();
  const navigate = useNavigate();

  /* ─── Filters ─────────────────────────────────────────── */
  const [datePreset, setDatePreset] = useState<DateRangePreset>('7d');
  const [startDate, setStartDate] = useState<string>(() => getPresetDates('7d').start);
  const [endDate, setEndDate] = useState<string>(() => getPresetDates('7d').end);
  const [selectedMember, setSelectedMember] = useState<{ id: string; label: string } | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 15;

  /* ─── Disciplines ─────────────────────────────────────── */
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  useEffect(() => {
    getDisciplines()
      .then((res) => setDisciplines(res.disciplines.filter((d) => d.isActive)))
      .catch(() => { /* silent */ });
  }, []);

  /* ─── Date preset handler ─────────────────────────────── */
  const applyPreset = useCallback((preset: DateRangePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
    setPage(1);
  }, []);

  /* ─── Query ───────────────────────────────────────────── */
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'attendance-logs',
      page,
      startDate,
      endDate,
      selectedMember?.id,
      disciplineFilter,
      methodFilter,
      deviceFilter,
      statusFilter,
    ],
    queryFn: () =>
      getAttendanceLogs({
        page,
        limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        memberId: selectedMember?.id,
        disciplineId: disciplineFilter || undefined,
        method: methodFilter || undefined,
        device: deviceFilter.trim() || undefined,
        status: statusFilter || undefined,
      }),
  });
  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* Reset page on filter change */
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, selectedMember, disciplineFilter, methodFilter, deviceFilter, statusFilter]);

  /* ─── Edit modal state ────────────────────────────────── */
  const [editRecord, setEditRecord] = useState<AttendanceLogRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (record: AttendanceLogRecord) => {
    setEditRecord(record);
    setEditCheckIn(formatDateForInput(record.checkInTime));
    setEditCheckOut(record.checkOutTime ? formatDateForInput(record.checkOutTime) : '');
    setEditNotes(record.notes ?? '');
    setEditReason('');
  };

  const handleEditSave = async () => {
    if (!editRecord || !editReason.trim()) return;
    setEditSubmitting(true);
    try {
      await updateAttendance(editRecord.id, {
        checkInTime: editCheckIn ? new Date(editCheckIn).toISOString() : undefined,
        checkOutTime: editCheckOut ? new Date(editCheckOut).toISOString() : undefined,
        notes: editNotes || undefined,
        reason: editReason.trim(),
      });
      toast.show({ type: 'success', title: 'Enregistrement mis à jour' });
      setEditRecord(null);
      void refetch();
    } catch {
      toast.show({ type: 'error', title: 'Échec de la mise à jour' });
    } finally {
      setEditSubmitting(false);
    }
  };

  /* ─── Delete modal state ──────────────────────────────── */
  const [deleteRecord, setDeleteRecord] = useState<AttendanceLogRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const openDelete = (record: AttendanceLogRecord) => {
    setDeleteRecord(record);
    setDeleteReason('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord || !deleteReason.trim()) return;
    setDeleteSubmitting(true);
    try {
      await deleteAttendance(deleteRecord.id, { reason: deleteReason.trim() });
      toast.show({ type: 'success', title: 'Enregistrement supprimé' });
      setDeleteRecord(null);
      void refetch();
    } catch {
      toast.show({ type: 'error', title: 'Échec de la suppression' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  /* ─── Audit drawer state ──────────────────────────────── */
  const [auditRecord, setAuditRecord] = useState<AttendanceLogRecord | null>(null);

  /* ─── CSV Export ──────────────────────────────────────── */
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportAttendanceLogs({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        memberId: selectedMember?.id,
        disciplineId: disciplineFilter || undefined,
        method: methodFilter || undefined,
        device: deviceFilter.trim() || undefined,
        status: statusFilter || undefined,
      });
      const csv = recordsToCsv(res.records);
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(csv, `attendance-${today}.csv`);
      toast.show({ type: 'success', title: `${res.records.length} enregistrements exportés` });
    } catch {
      toast.show({ type: 'error', title: "Échec de l'export" });
    } finally {
      setExporting(false);
    }
  };

  /* ─── Filter options ──────────────────────────────────── */
  const disciplineOptions = [
    { value: '', label: 'Toutes disciplines' },
    ...disciplines.map((d) => ({ value: d.id, label: d.name })),
  ];

  const methodOptions = [
    { value: '', label: 'Toutes méthodes' },
    { value: 'face', label: 'Reconnaissance faciale' },
    { value: 'manual', label: 'Manuel' },
    { value: 'barcode', label: 'Code-barres' },
  ];

  const statusOptions = [
    { value: '', label: 'Tous' },
    { value: 'present', label: 'Arrivé' },
    { value: 'left', label: 'Départ' },
  ];

  /* ─── Columns ─────────────────────────────────────────── */
  const columns: TableColumn<AttendanceLogRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      accessor: (row) => (
        <span className="whitespace-nowrap text-neutral-700 tabular-nums">
          {formatDate(row.checkInTime)}
        </span>
      ),
      sortable: true,
      width: '100px',
    },
    {
      key: 'heure',
      header: 'Heure',
      accessor: (row) => (
        <span className="whitespace-nowrap font-mono text-xs text-neutral-700 tabular-nums">
          {formatTime(row.checkInTime)}
        </span>
      ),
      width: '70px',
    },
    {
      key: 'membre',
      header: 'Membre',
      accessor: (row) => (
        <span className="font-medium text-neutral-900">
          {row.member.firstNameLatin} {row.member.lastNameLatin}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'discipline',
      header: 'Discipline',
      accessor: (row) => (
        <span className="text-neutral-600">{row.discipline?.name ?? '—'}</span>
      ),
    },
    {
      key: 'methode',
      header: 'Méthode',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-neutral-500">
            <MethodIcon method={row.method} size={13} />
          </span>
          <Badge variant={methodBadge(row.method)} label={methodLabel(row.method)} />
        </span>
      ),
      width: '160px',
    },
    {
      key: 'appareil',
      header: 'Appareil',
      accessor: (row) =>
        row.device ? (
          <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
            <MonitorSmallIcon size={13} />
            {row.device}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
      width: '110px',
    },
    {
      key: 'statut',
      header: 'Statut',
      accessor: (row) => (
        <Badge variant={statusBadge(row.status)} label={statusLabel(row.status)} />
      ),
      width: '90px',
    },
    {
      key: 'duree',
      header: 'Durée',
      accessor: (row) => (
        <span className="font-mono text-xs text-neutral-600 tabular-nums">
          {formatDuration(row.checkInTime, row.checkOutTime)}
        </span>
      ),
      width: '70px',
    },
    {
      key: 'notes',
      header: 'Notes',
      accessor: (row) =>
        row.notes ? (
          <span
            className="block max-w-[140px] truncate text-xs text-neutral-500"
            title={row.notes}
          >
            {row.notes}
          </span>
        ) : (
          <span className="text-neutral-300">—</span>
        ),
      width: '140px',
    },
    {
      key: 'intervenant',
      header: 'Intervenant',
      accessor: (row) =>
        row.operator ? (
          <span className="text-xs text-neutral-600">{row.operator.fullNameLatin}</span>
        ) : (
          <span className="text-neutral-300">—</span>
        ),
      width: '130px',
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {/* Voir le membre */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void navigate(`/members/${row.memberId}`);
            }}
            aria-label={`Voir le membre ${row.member.firstNameLatin}`}
            title="Voir le membre"
            className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <EyeIcon size={14} />
          </button>

          {/* Historique */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAuditRecord(row);
            }}
            aria-label="Voir l'historique des modifications"
            title="Historique"
            className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <HistorySmallIcon size={14} />
          </button>

          {/* Edit — admin only */}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              aria-label={`Modifier l'enregistrement de ${row.member.firstNameLatin}`}
              title="Modifier"
              className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <EditIcon size={14} />
            </button>
          )}

          {/* Delete — admin only */}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDelete(row);
              }}
              aria-label={`Supprimer l'enregistrement de ${row.member.firstNameLatin}`}
              title="Supprimer"
              className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      ),
      width: isAdmin ? '130px' : '80px',
      align: 'right',
    },
  ];

  /* ─── Date input style (shared) ──────────────────────── */
  const dateInputClass =
    'h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <section aria-labelledby="log-heading" className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="log-heading" className="text-lg font-semibold text-neutral-900">
          Journal de présence
        </h2>
        <Button
          variant="secondary"
          iconLeft={<DownloadIcon size={15} />}
          loading={exporting}
          onClick={() => void handleExport()}
          aria-label="Exporter en CSV"
        >
          Exporter CSV
        </Button>
      </div>

      {/* Filters card */}
      <Card padding="sm">
        <div className="flex flex-col gap-3">
          {/* Row 1: Date range chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-600 shrink-0">Période :</span>
            {(
              [
                { id: 'today', label: "Aujourd'hui" },
                { id: '7d', label: '7 derniers jours' },
                { id: 'month', label: 'Ce mois' },
                { id: 'custom', label: 'Personnalisé' },
              ] as { id: DateRangePreset; label: string }[]
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyPreset(chip.id)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  datePreset === chip.id
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                ].join(' ')}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {datePreset === 'custom' && (
            <div className="flex flex-wrap gap-3">
              <div className="min-w-0 flex-1 lg:max-w-[160px]">
                <label htmlFor="filter-start-date" className="mb-1 block text-sm font-medium text-neutral-700">
                  Du
                </label>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className={dateInputClass}
                />
              </div>
              <div className="min-w-0 flex-1 lg:max-w-[160px]">
                <label htmlFor="filter-end-date" className="mb-1 block text-sm font-medium text-neutral-700">
                  Au
                </label>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className={dateInputClass}
                />
              </div>
            </div>
          )}

          {/* Row 2: Other filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <MemberCombobox value={selectedMember} onChange={(v) => { setSelectedMember(v); setPage(1); }} />

            <div className="min-w-0 flex-1 lg:max-w-[170px]">
              <Select
                label="Discipline"
                options={disciplineOptions}
                value={disciplineFilter ?? ''}
                onChange={(v) => setDisciplineFilter(v || null)}
              />
            </div>

            <div className="min-w-0 flex-1 lg:max-w-[180px]">
              <Select
                label="Méthode"
                options={methodOptions}
                value={methodFilter ?? ''}
                onChange={(v) => setMethodFilter(v || null)}
              />
            </div>

            <div className="min-w-0 flex-1 lg:max-w-[160px]">
              <label htmlFor="filter-device" className="mb-1 block text-sm font-medium text-neutral-700">
                Appareil
              </label>
              <input
                id="filter-device"
                type="text"
                placeholder="ex. Kiosk-01"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className={dateInputClass}
              />
            </div>

            <div className="min-w-0 flex-1 lg:max-w-[140px]">
              <Select
                label="Statut"
                options={statusOptions}
                value={statusFilter ?? ''}
                onChange={(v) => setStatusFilter(v || null)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table area */}
      {isError ? (
        <ErrorState
          title="Impossible de charger le journal."
          description="Vérifiez votre connexion et réessayez."
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={records}
            getRowId={(row) => row.id}
            loading={isLoading}
            pageSize={limit}
            emptyTitle="Aucun enregistrement."
            emptyMessage="Aucun résultat ne correspond aux filtres sélectionnés."
            onRowClick={(row) => setAuditRecord(row)}
          />

          {/* Server-side pagination */}
          {!isLoading && total > limit && (
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span>
                Page {page} sur {totalPages} — {total} enregistrements
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  variant="secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={editRecord !== null}
        onClose={() => setEditRecord(null)}
        title="Modifier l'enregistrement"
        size="md"
      >
        {editRecord && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              Modification de l'enregistrement de{' '}
              <span className="font-semibold">
                {editRecord.member.firstNameLatin} {editRecord.member.lastNameLatin}
              </span>
            </p>

            <div>
              <label
                htmlFor="edit-checkin-time"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Heure d'arrivée
              </label>
              <input
                id="edit-checkin-time"
                type="datetime-local"
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
                className={dateInputClass}
              />
            </div>

            <div>
              <label
                htmlFor="edit-checkout-time"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Heure de départ
              </label>
              <input
                id="edit-checkout-time"
                type="datetime-local"
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
                className={dateInputClass}
              />
            </div>

            <Input
              label="Notes"
              placeholder="Notes optionnelles..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />

            <Input
              label="Motif (obligatoire)"
              placeholder="Pourquoi modifiez-vous cet enregistrement ?"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setEditRecord(null)}
                disabled={editSubmitting}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleEditSave()}
                loading={editSubmitting}
                disabled={!editReason.trim()}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Delete Modal ─────────────────────────────────────────── */}
      <Modal
        open={deleteRecord !== null}
        onClose={() => setDeleteRecord(null)}
        title="Supprimer l'enregistrement"
        size="sm"
      >
        {deleteRecord && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              Êtes-vous sûr de vouloir supprimer l'enregistrement de{' '}
              <span className="font-semibold">
                {deleteRecord.member.firstNameLatin} {deleteRecord.member.lastNameLatin}
              </span>{' '}
              ? Cette action est irréversible.
            </p>

            <Input
              label="Motif (obligatoire)"
              placeholder="Pourquoi supprimez-vous cet enregistrement ?"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteRecord(null)}
                disabled={deleteSubmitting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleDeleteConfirm()}
                loading={deleteSubmitting}
                disabled={!deleteReason.trim()}
              >
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Audit Drawer ─────────────────────────────────────────── */}
      <AuditDrawer record={auditRecord} onClose={() => setAuditRecord(null)} />
    </section>
  );
}
