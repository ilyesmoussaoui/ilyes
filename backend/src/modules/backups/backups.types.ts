import { z } from 'zod';

export const restoreBackupSchema = z.object({
  filename: z.string().min(1).max(200),
  confirmToken: z.string().min(16, 'confirmToken is required and must match BACKUP_RESTORE_TOKEN'),
});

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
