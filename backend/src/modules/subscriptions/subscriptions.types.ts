import { z } from 'zod';

// No body needed — admin-only trigger endpoint
export const processRenewalsSchema = z.object({}).optional();
