# API Contract — Steps 5-8 Endpoints

## Disciplines Module

### GET /api/v1/disciplines
Auth: required
Response 200: { success: true, data: { disciplines: Array<{ id, name, isActive }> } }

### GET /api/v1/disciplines/:id/time-slots
Auth: required
Params: { id: UUID }
Response 200: { success: true, data: { timeSlots: Array<{ id, disciplineId, dayOfWeek, startTime, endTime, maxCapacity }> } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### GET /api/v1/disciplines/:id/instructors
Auth: required
Params: { id: UUID }
Response 200: { success: true, data: { instructors: Array<{ id, fullNameLatin, fullNameArabic }> } }

### POST /api/v1/members/:id/enrollments
Auth: required + canWrite
Params: { id: UUID }
Body: { enrollments: Array<{ disciplineId: UUID, instructorId?: UUID, beltRank?: string, schedules: Array<{ dayOfWeek: 0-6, timeSlotId: UUID }> }> }
Response 200: { success: true, data: { enrollments, warnings? } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

## Documents Module

### POST /api/v1/members/:id/documents
Auth: required + canWrite
Params: { id: UUID }
Body: { documents: Array<{ type: DocumentType, issueDate?: ISO-date, expiryDate?: ISO-date }> }
Response 200: { success: true, data: { documents } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### POST /api/v1/members/:id/documents/upload
Auth: required + canWrite
Params: { id: UUID }
Content-Type: multipart/form-data
Fields: file (max 5MB, PDF/JPEG/PNG), documentId (UUID)
Response 200: { success: true, data: { documentId, filePath } }
Response 413: { success: false, error: { code: "PAYLOAD_TOO_LARGE", message } }

## Billing Module

### GET /api/v1/subscription-plans
Auth: required
Response 200: { success: true, data: { plans } }

### GET /api/v1/equipment
Auth: required
Response 200: { success: true, data: { equipment } }

### GET /api/v1/members/search?q=
Auth: required
Query: { q: string (min 2 chars) }
Response 200: { success: true, data: { members } }

### POST /api/v1/members/:id/billing
Auth: required + canWrite
Params: { id: UUID }
Body: { subscriptions, equipment, familyLinks, payment }
Response 201: { success: true, data: { subscriptions, equipment, familyLinks, payment } }

## Member Finalization

### POST /api/v1/members/:id/finalize
Auth: required + canWrite
Params: { id: UUID }
Response 200: { success: true, data: { member } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message } }

## Attendance Module

### GET /api/v1/attendance/present
Auth: required + role(admin, manager, receptionist, coach)
Response 200: { success: true, data: { records: Array<AttendanceRecordWithMember> } }

### POST /api/v1/attendance/checkin
Auth: required + role(admin, manager, receptionist, coach)
Body: { memberId: UUID, disciplineId?: UUID, method: 'face' | 'manual' | 'barcode', device?: string, notes?: string }
Response 201: { success: true, data: { record: AttendanceRecordWithMember } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }
Socket.IO: emits `attendance:checkin` with { record }

### POST /api/v1/attendance/:id/checkout
Auth: required + role(admin, manager, receptionist, coach)
Params: { id: UUID }
Response 200: { success: true, data: { record: AttendanceRecordWithMember } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 409: { success: false, error: { code: "ALREADY_CHECKED_OUT", message } }
Socket.IO: emits `attendance:checkout` with { record }

### POST /api/v1/attendance/mass-checkout
Auth: required + role(admin, manager)
Response 200: { success: true, data: { count: number, timestamp: string } }
Socket.IO: emits `attendance:mass-checkout` with { count, timestamp }

### GET /api/v1/attendance/logs
Auth: required + role(admin, manager, receptionist, coach)
Query: { page?: number, limit?: number, startDate?: ISO, endDate?: ISO, memberId?: UUID, disciplineId?: UUID, method?: AttendanceMethod, device?: string, status?: 'present' | 'left' | 'all', search?: string }
Response 200: { success: true, data: { records, total, page, limit } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/attendance/stats/today
Auth: required + role(admin, manager, receptionist, coach)
Response 200: { success: true, data: { totalCheckIns: number, currentlyPresent: number, totalCheckOuts: number } }

### GET /api/v1/attendance/sessions/today
Auth: required + role(admin, manager, receptionist, coach)
Response 200: { success: true, data: { sessions: Array<{ id, disciplineId, disciplineName, dayOfWeek, startTime, endTime, maxCapacity, enrolledCount }> } }

### GET /api/v1/attendance/:id
Auth: required + role(admin, manager, receptionist, coach)
Params: { id: UUID }
Response 200: { success: true, data: { record: AttendanceRecordWithMember } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### PATCH /api/v1/attendance/:id
Auth: required + role(admin)
Params: { id: UUID }
Body: { checkInTime?: ISO, checkOutTime?: ISO | null, disciplineId?: UUID | null, method?: AttendanceMethod, notes?: string | null, reason: string }
Response 200: { success: true, data: { record: AttendanceRecordWithMember } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### DELETE /api/v1/attendance/:id
Auth: required + role(admin)
Params: { id: UUID }
Body: { reason: string }
Response 204: (no body)
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

## Kiosk Module

### POST /api/v1/kiosk/match
Auth: required + role(admin, manager, receptionist)
Body: { image_base64: string }
Response 200: { success: true, data: { member: { id, firstNameLatin, lastNameLatin, firstNameArabic, lastNameArabic, photoPath, status, disciplines: string[] }, confidence: number, canAutoCheckIn: boolean, alerts: Array<{ type: 'expired' | 'unpaid' | 'expiring_soon' | 'duplicate_checkin' | 'consecutive_absence', message: string, ...extra }> } }
Response 404: { success: false, error: { code: "NO_MATCH", message } }
Response 502: { success: false, error: { code: "FACE_SERVICE_ERROR", message } }
Response 503: { success: false, error: { code: "FACE_SERVICE_UNAVAILABLE", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### POST /api/v1/kiosk/check-in
Auth: required + role(admin, manager, receptionist)
Body: { member_id: UUID, method: 'face' | 'manual', discipline_id?: UUID, confidence?: number }
Response 201: { success: true, data: { record: AttendanceRecordWithMember, alerts: Array<KioskAlert> } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }
Socket.IO: emits `attendance:checkin` with { record }

### GET /api/v1/kiosk/search?q=query
Auth: required + role(admin, manager, receptionist)
Query: { q: string (min 1, max 200) }
Response 200: { success: true, data: { members: Array<{ id, firstNameLatin, lastNameLatin, firstNameArabic, lastNameArabic, photoPath, status, disciplines: string[] }> } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/kiosk/face-service/health
Auth: required + role(admin, manager, receptionist)
Response 200: { success: true, data: { status: string, model_loaded: boolean } }
Note: Returns { status: "offline", model_loaded: false } if face service is unreachable.

## Payments Module

### POST /api/v1/payments
Auth: required + role(admin, manager, receptionist, accountant)
Body: { memberId: UUID, items: Array<{ description: string, amount: int (centimes), type: 'subscription' | 'equipment' | 'fee' | 'registration' | 'other' }>, paymentType: 'full' | 'partial', paidAmount: int (centimes), notes?: string }
Response 201: { success: true, data: { payment: { id, memberId, receiptNumber, totalAmount, paidAmount, remaining, paymentType, notes, items, createdAt } } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/payments
Auth: required + role(admin, manager, receptionist, accountant)
Query: { page?: number, limit?: number, memberId?: UUID, paymentType?: 'full' | 'partial' | 'refund' | 'adjustment', dateFrom?: ISO-date, dateTo?: ISO-date, search?: string, sortBy?: 'createdAt' | 'totalAmount' | 'receiptNumber', sortOrder?: 'asc' | 'desc' }
Response 200: { success: true, data: { data: Array<PaymentWithDetails>, total, page, totalPages } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/payments/:id
Auth: required + role(admin, manager, receptionist, accountant)
Params: { id: UUID }
Response 200: { success: true, data: { payment: PaymentWithDetails } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### POST /api/v1/payments/:id/refund
Auth: required + role(admin, manager, receptionist, accountant)
Params: { id: UUID }
Body: { reason: string }
Response 201: { success: true, data: { payment: { ...refundPayment, paymentType: 'refund', totalAmount: negative, items: [...negated] } } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "INVALID_OPERATION", message } }

### POST /api/v1/pos/checkout
Auth: required + role(admin, manager, receptionist, accountant)
Body: { memberId?: UUID, items: Array<{ description: string, amount: int (centimes), type: PaymentItemType, quantity: int }>, paymentType: 'full' | 'partial', paidAmount: int (centimes), notes?: string }
Response 201: { success: true, data: { payment: PaymentWithItems } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

## Expenses Module

### POST /api/v1/expenses
Auth: required + role(admin, manager, accountant)
Body: { date: ISO-date, category: string, amount: int (centimes), description?: string, receiptPath?: string }
Response 201: { success: true, data: { expense } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/expenses
Auth: required + role(admin, manager, accountant)
Query: { page?: number, limit?: number, dateFrom?: ISO-date, dateTo?: ISO-date, category?: string, sortBy?: 'date' | 'amount' | 'category', sortOrder?: 'asc' | 'desc' }
Response 200: { success: true, data: { data: Array<Expense>, total, page, totalPages } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/expenses/:id
Auth: required + role(admin, manager, accountant)
Params: { id: UUID }
Response 200: { success: true, data: { expense } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### PATCH /api/v1/expenses/:id
Auth: required + role(admin, manager, accountant)
Params: { id: UUID }
Body: { date?: ISO-date, category?: string, amount?: int (centimes), description?: string | null, receiptPath?: string | null }
Response 200: { success: true, data: { expense } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### DELETE /api/v1/expenses/:id
Auth: required + role(admin, manager, accountant)
Params: { id: UUID }
Response 204: (no body)
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

## Subscriptions Module

### POST /api/v1/subscriptions/process-renewals
Auth: required + role(admin)
Body: (none)
Response 200: { success: true, data: { renewalsProcessed: number, details: Array<{ memberId, oldSubscriptionId, newSubscriptionId, paymentId, notificationId }> } }

## Notifications Module

### GET /api/v1/notifications
Auth: required + role(admin, manager, receptionist, accountant)
Query: { page?: number, limit?: number, type?: NotificationType, isRead?: 'true' | 'false', memberId?: UUID }
Response 200: { success: true, data: { data: Array<NotificationWithMember>, total, page, totalPages } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### PATCH /api/v1/notifications/:id/read
Auth: required + role(admin, manager, receptionist, accountant)
Params: { id: UUID }
Response 200: { success: true, data: { notification } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

## Attendance Module (Absence Detection)

### POST /api/v1/attendance/check-absences
Auth: required + role(admin, manager)
Response 200: { success: true, data: { absences: Array<{ memberId, memberName, consecutiveAbsences, disciplineName, missedDates }>, notificationsCreated: number } }

## Sessions & Scheduling Module

### GET /api/v1/sessions/time-slots
Auth: required + role(admin, manager, coach)
Query: { dayOfWeek?: 0-6 }
Response 200: { success: true, data: { timeSlots: Array<{ id, disciplineId, discipline: { id, name }, coachId, coach: { id, fullNameLatin } | null, dayOfWeek, startTime, endTime, maxCapacity, currentEnrollment, room }> } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### POST /api/v1/sessions/time-slots
Auth: required + role(admin, manager, coach)
Body: { disciplineId: UUID, coachId?: UUID, dayOfWeek: 0-6, startTime: "HH:mm", endTime: "HH:mm", maxCapacity: int, room?: string }
Response 201: { success: true, data: { timeSlot: { id, disciplineId, discipline, coachId, coach, dayOfWeek, startTime, endTime, maxCapacity, room }, warnings: Array<{ type: "coach_overlap" | "room_overlap", message }> } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### PUT /api/v1/sessions/time-slots/:id
Auth: required + role(admin, manager, coach)
Params: { id: UUID }
Body: { disciplineId?: UUID, coachId?: UUID | null, dayOfWeek?: 0-6, startTime?: "HH:mm", endTime?: "HH:mm", maxCapacity?: int, room?: string | null }
Response 200: { success: true, data: { timeSlot, warnings } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### DELETE /api/v1/sessions/time-slots/:id
Auth: required + role(admin, manager, coach)
Params: { id: UUID }
Response 204: (no body)
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### GET /api/v1/sessions/time-slots/:id/roster
Auth: required + role(admin, manager, coach)
Params: { id: UUID }
Response 200: { success: true, data: { timeSlot: { id, discipline, startTime, endTime, maxCapacity, dayOfWeek, coach }, roster: Array<{ scheduleId, memberId, member: { id, firstNameLatin, lastNameLatin, photoPath }, attendanceToday: { id, checkInTime } | null }>, enrollment: { current, max } } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }

### POST /api/v1/sessions/time-slots/:id/attendance
Auth: required + role(admin, manager, coach)
Params: { id: UUID }
Body: { memberId: UUID, present: boolean }
Response 201: { success: true, data: { record: { id, checkInTime } } } (when present=true)
Response 201: { success: true, data: { removed: true } } (when present=false)
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 409: { success: false, error: { code: "DUPLICATE", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### POST /api/v1/sessions/check-conflicts
Auth: required + role(admin, manager, coach)
Body: { coachId?: UUID, room?: string, dayOfWeek: 0-6, startTime: "HH:mm", endTime: "HH:mm", excludeId?: UUID }
Response 200: { success: true, data: { hasConflict: boolean, conflicts: Array<{ type: "coach_overlap" | "room_overlap", message }> } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

## Reports Module

### GET /api/v1/reports/attendance
Auth: required + role(admin, manager, accountant)
Query: { dateFrom?: string, dateTo?: string, disciplineId?: UUID, groupBy?: "day" | "week" | "month" }
Response 200: { success: true, data: { summary: { totalCheckIns, uniqueMembers, avgDailyCheckIns, peakHour, topDiscipline }, timeSeries: [{ date, count }], byDiscipline: [{ name, count }], byMethod: [{ method, count }], byHour: [{ hour: 0-23, count }], lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/financial
Auth: required + role(admin, manager, accountant)
Query: { dateFrom?: string, dateTo?: string, groupBy?: "day" | "week" | "month", paymentType?: "full" | "partial" | "refund" | "adjustment" }
Response 200: { success: true, data: { summary: { totalRevenue, totalExpenses, netIncome, avgTransactionValue, totalRefunds }, revenueTimeSeries: [{ date, revenue, expenses }], byPaymentType: [{ type, amount, count }], byCategory: [{ category, amount }], topMembers: [{ memberId, name, totalPaid }], lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/membership
Auth: required + role(admin, manager, accountant)
Query: { dateFrom?: string, dateTo?: string }
Response 200: { success: true, data: { summary: { totalMembers, activeMembers, newMembersInRange, expiringSubscriptions, retentionRate }, byStatus: [{ status, count }], byType: [{ type, count }], byGender: [{ gender, count }], growthTimeSeries: [{ date, newMembers, totalActive }], subscriptionsByPlan: [{ planType, count, revenue }], lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/inventory
Auth: required + role(admin, manager, accountant)
Query: { dateFrom?: string, dateTo?: string, equipmentId?: UUID }
Response 200: { success: true, data: { summary: { totalItems, lowStockCount, totalStockValue, totalSalesValue }, items: [{ id, name, currentStock, price, totalSold, revenue }], stockMovements: [{ date, item, quantityChange, reason }], lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/documents
Auth: required + role(admin, manager, accountant)
Query: { dateFrom?: string, dateTo?: string, documentType?: DocumentType, status?: DocumentStatus }
Response 200: { success: true, data: { summary: { totalDocuments, expiredCount, expiringCount, complianceRate }, byType: [{ type, total, valid, expired, pending }], byStatus: [{ status, count }], expiringDocuments: [{ memberId, memberName, documentType, expiryDate }], lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/custom
Auth: required + role(admin, manager, accountant)
Query: { metrics: "attendance_count,revenue,..." (comma-separated), dateFrom?, dateTo?, disciplineId?, memberType?, status?, groupBy?: "day" | "week" | "month", chartType?: "bar" | "line" | "pie" | "heatmap" }
Response 200: { success: true, data: { metrics: { [metricName]: { total, series: [{ date, value }] } }, chartType, groupBy, lastUpdated } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/export
Auth: required + role(admin, manager, accountant)
Query: { reportType: "attendance" | "financial" | "membership" | "inventory" | "documents", format?: "excel" | "pdf", dateFrom?, dateTo?, disciplineId?, equipmentId?, documentType?, documentStatus?, paymentType? }
Response 200: { success: true, data: { filename, headers: string[], rows: any[][], generatedAt } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### POST /api/v1/reports/templates
Auth: required + role(admin, manager, accountant)
Body: { name: string, config: { metrics: string[], dateFrom?, dateTo?, disciplineId?, memberType?, status?, groupBy?, chartType? } }
Response 201: { success: true, data: { id, name, config, createdAt } }
Response 409: { success: false, error: { code: "DUPLICATE_TEMPLATE", message } }
Response 422: { success: false, error: { code: "VALIDATION_ERROR", message, details } }

### GET /api/v1/reports/templates
Auth: required + role(admin, manager, accountant)
Response 200: { success: true, data: { templates: [{ id, name, config, createdAt, updatedAt }] } }

## Admin / Backups Module

### GET /api/v1/admin/backups
Auth: required + role(admin)
Purpose: List on-disk backup snapshots (auto, nightly, manual, pre_restore). Sorted newest-first.
Response 200: { success: true, data: { backups: Array<{ filename: string, sizeBytes: number, createdAt: ISO, mode: "prisma" | "pgdump", kind: "auto" | "nightly" | "manual" | "pre_restore" }> } }

### POST /api/v1/admin/backups
Auth: required + role(admin)
Purpose: Trigger an on-demand manual backup. Coalesces with any in-flight backup.
Response 201: { success: true, data: { backup: { filename, sizeBytes, createdAt, mode, kind: "manual" } } }
Response 500: { success: false, error: { code: "BACKUP_FAILED", message } }

### POST /api/v1/admin/backups/restore
Auth: required + role(admin)
Purpose: Restore from a named snapshot. A pre_restore snapshot is automatically taken first.
Body: { filename: string (must match /^backup_(auto|nightly|manual|pre_restore)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.(json|sql)\.gz$/), confirmToken: string (must equal BACKUP_RESTORE_TOKEN env) }
Response 200: { success: true, data: { filename, restoredAt: ISO } }
Response 403: { success: false, error: { code: "INVALID_TOKEN", message } }
Response 404: { success: false, error: { code: "NOT_FOUND", message } }
Response 409: { success: false, error: { code: "RESTORE_IN_PROGRESS", message } }
Response 422: { success: false, error: { code: "INVALID_FILENAME" | "VALIDATION_ERROR" | "UNSUPPORTED_RESTORE" | "UNSUPPORTED_VERSION", message } }
Response 503: { success: false, error: { code: "RESTORE_DISABLED", message } } (when BACKUP_RESTORE_TOKEN is not configured)

## Internal Services (no HTTP surface)

### SMS dispatcher (backend/src/modules/sms)
Non-blocking, queued, rate-limited (SMS_DAILY_PER_MEMBER_CAP per member per UTC day).
Providers: console (default), twilio, vonage, http. Selected via SMS_PROVIDER env.
Triggered from attendance check-ins (`dispatchCheckinAlerts`) for off-schedule and minor parent-notify cases.
Retries: 3 attempts with 250ms/500ms exponential backoff; audit row written on sent/failed.

### Auto-backup scheduler
- Nightly cron: `BACKUP_CRON` (default `0 3 * * *`) in timezone `process.env.TZ` (defaults to `Africa/Algiers`).
- Post-transaction: `scheduleAutoBackup()` is called from `payments.service`, `billing.service`, and `subscriptions.service` after successful financial mutations. Debounced 30s to coalesce bursts (POS batches, refunds).
- Rotation policy: keep last BACKUP_RETENTION_DAILY (30) auto/nightly snapshots + last BACKUP_RETENTION_MONTHLY (12) month-end snapshots. Manual + pre_restore snapshots are never pruned.
