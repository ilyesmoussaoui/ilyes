import 'fastify';
import type { UserRole } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: UserRole;
      roleId: string | null;
      fullNameLatin: string;
      fullNameArabic: string | null;
      lastLogin: Date | null;
    };
  }
}
