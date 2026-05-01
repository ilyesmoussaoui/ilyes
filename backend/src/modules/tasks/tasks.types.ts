import { z } from 'zod';

// ─── Create task body ─────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  type: z.enum(['call_parent', 'general'], {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be call_parent or general',
  }),
  memberId: z.string().uuid('Invalid member id').optional(),
  assignedTo: z.string().uuid('Invalid user id').optional(),
  dueDate: z.string().date('Invalid date — expected YYYY-MM-DD').optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ─── List tasks query ─────────────────────────────────────────────────────────

export const listTasksQuerySchema = z.object({
  status: z.enum(['open', 'done', 'cancelled']).optional(),
  memberId: z.string().uuid('Invalid member id').optional(),
  assignedTo: z.string().uuid('Invalid user id').optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// ─── Internal create input (used by absence.service) ─────────────────────────

export type CreateTaskServiceInput = {
  type: 'call_parent' | 'general';
  memberId?: string;
  assignedTo?: string;
  dueDate?: string;
  notes?: string;
  createdBy?: string;
};
