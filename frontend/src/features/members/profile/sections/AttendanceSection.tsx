import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Skeleton, Badge } from '../../../../components/ui';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../../components/ui/Icon';
import type { AttendanceInfo, PaginatedResponse } from '../profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { getMemberAttendance } from '../profileApi';
import { formatDate } from '../profileUtils';

interface AttendanceSectionProps {
  memberId: string;
}

type HeatmapStatus = 'present' | 'absent' | 'no-session' | 'future' | 'today';

interface HeatmapDay {
  day: number;
  status: HeatmapStatus;
  date: Date;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function AttendanceSection({ memberId }: AttendanceSectionProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [calendarData, setCalendarData] = useState<AttendanceInfo[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [tableData, setTableData] = useState<PaginatedResponse<AttendanceInfo> | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const res = await getMemberAttendance(memberId, { month, year, limit: 100 });
      setCalendarData(res.data);
    } catch {
      setCalendarError('Failed to load attendance data.');
    } finally {
      setCalendarLoading(false);
    }
  }, [memberId, month, year]);

  const loadTable = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      const res = await getMemberAttendance(memberId, { page: tablePage, limit: 15 });
      setTableData(res);
    } catch {
      setTableError('Failed to load attendance history.');
    } finally {
      setTableLoading(false);
    }
  }, [memberId, tablePage]);

  useEffect(() => { void loadCalendar(); }, [loadCalendar]);
  useEffect(() => { void loadTable(); }, [loadTable]);

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else { setMonth((m) => m - 1); }
  };

  const goToNextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else { setMonth((m) => m + 1); }
  };

  // Build heatmap grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const heatmapDays: (HeatmapDay | null)[] = [];

  // padding for first row
  for (let i = 0; i < firstDayOfWeek; i++) heatmapDays.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const attendance = calendarData.find((a) => a.date && a.date.startsWith(dateStr));

    let status: HeatmapStatus;
    if (date.getTime() === todayDate.getTime()) {
      status = 'today';
    } else if (date > todayDate) {
      status = 'future';
    } else if (attendance) {
      status = attendance.status === 'present' ? 'present' : 'absent';
    } else {
      status = 'no-session';
    }

    heatmapDays.push({ day: d, status, date });
  }

  const colorMap: Record<HeatmapStatus, string> = {
    present: 'bg-success text-white',
    absent: 'bg-danger-bg text-danger-fg border border-danger/20',
    'no-session': 'bg-neutral-100 text-neutral-400',
    future: 'bg-neutral-50 text-neutral-300',
    today: 'bg-primary-500 text-white ring-2 ring-primary-300',
  };

  const columns: TableColumn<AttendanceInfo>[] = [
    {
      key: 'date',
      header: 'Date',
      accessor: (row) => formatDate(row.date),
      sortable: true,
    },
    {
      key: 'discipline',
      header: 'Discipline',
      accessor: (row) => row.disciplineName,
    },
    {
      key: 'timeIn',
      header: 'Time in',
      accessor: (row) => row.timeIn ?? '—',
    },
    {
      key: 'timeOut',
      header: 'Time out',
      accessor: (row) => row.timeOut ?? '—',
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (row) => (
        <span className="capitalize text-neutral-600">{row.method}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => {
        const status = row.status ?? 'present';
        return (
          <Badge
            variant={status === 'present' ? 'active' : status === 'absent' ? 'expired' : 'pending'}
            label={status.charAt(0).toUpperCase() + status.slice(1)}
          />
        );
      },
    },
  ];

  const isAtLimit = year > today.getFullYear() ||
    (year === today.getFullYear() && month >= today.getMonth() + 1);

  return (
    <section aria-labelledby="attendance-heading" className="flex flex-col gap-4">
      <h2 id="attendance-heading" className="sr-only">Attendance</h2>

      {/* Monthly Heatmap */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-semibold text-neutral-900">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="default"
              onClick={goToPrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeftIcon size={16} />
            </Button>
            <Button
              variant="ghost"
              size="default"
              onClick={goToNextMonth}
              disabled={isAtLimit}
              aria-label="Next month"
            >
              <ChevronRightIcon size={16} />
            </Button>
          </div>
        </div>

        {calendarLoading ? (
          <Skeleton variant="card" />
        ) : calendarError ? (
          <p className="text-sm text-danger-fg">{calendarError}</p>
        ) : (
          <>
            {/* Day headers */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-neutral-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div
              className="grid grid-cols-7 gap-1"
              role="grid"
              aria-label={`Attendance calendar for ${MONTH_NAMES[month - 1]} ${year}`}
            >
              {heatmapDays.map((day, idx) => (
                <div
                  key={idx}
                  role="gridcell"
                  aria-label={day ? `${day.date.toLocaleDateString('en-GB')}: ${day.status}` : ''}
                  className={`aspect-square flex items-center justify-center rounded-md text-xs font-medium ${
                    day ? colorMap[day.status] : ''
                  }`}
                >
                  {day?.day ?? ''}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-success" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-danger-bg border border-danger/20" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-neutral-100" />
                <span>No session</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-primary-500" />
                <span>Today</span>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Attendance Table */}
      {tableLoading ? (
        <Skeleton variant="card" />
      ) : tableError ? (
        <Card>
          <p className="text-sm text-danger-fg">{tableError}</p>
          <Button variant="ghost" onClick={() => void loadTable()} className="mt-2">
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <Table
            columns={columns}
            data={tableData?.data ?? []}
            getRowId={(row) => row.id}
            emptyTitle="No attendance records"
            emptyMessage="No attendance records found for this member."
          />
          {tableData && tableData.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-neutral-600">
              <span>Page {tablePage} of {tableData.totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={tablePage === tableData.totalPages}
                  onClick={() => setTablePage((p) => Math.min(tableData.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
