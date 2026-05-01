import { z } from 'zod';

// ─── Face match request ─────────────────────────────────────────────────────

export const matchSchema = z.object({
  image_base64: z
    .string({ required_error: 'image_base64 is required' })
    .min(1, 'image_base64 must not be empty'),
});

export type MatchInput = z.infer<typeof matchSchema>;

// ─── Kiosk check-in request ─────────────────────────────────────────────────

export const kioskCheckInSchema = z.object({
  member_id: z.string().uuid('Invalid member id'),
  method: z.enum(['face', 'manual'], {
    required_error: 'Method is required',
    invalid_type_error: 'Method must be face or manual',
  }),
  discipline_id: z.string().uuid('Invalid discipline id').optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type KioskCheckInInput = z.infer<typeof kioskCheckInSchema>;

// ─── Search query ───────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .trim()
    .min(1, 'Search query must not be empty')
    .max(200, 'Search query is too long'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ─── Alert types ────────────────────────────────────────────────────────────

export type KioskAlert = {
  type: 'expired' | 'unpaid' | 'expiring_soon' | 'duplicate_checkin' | 'consecutive_absence';
  message: string;
  [key: string]: unknown;
};

// ─── Face service response types ────────────────────────────────────────────

/** Actual shape returned by the Python face service POST /match */
export type FaceMatchResponse =
  | {
      success: true;
      match: {
        member_id: string;
        confidence: number;
        embedding_id: string;
      } | null;
    }
  | {
      success: false;
      error: string;
    };

/** Transformed shape returned to frontend clients */
export type FaceServiceHealthResponse = {
  online: boolean;
  latencyMs: number | null;
};
