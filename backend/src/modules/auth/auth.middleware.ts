import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { UserRole } from '@prisma/client';
import { fail } from '../../lib/response.js';
import { AuthError, getUserForRequest, verifyAccessToken } from './auth.service.js';

function readAccessToken(request: FastifyRequest): string | null {
  const cookieToken = request.cookies?.access_token;
  if (cookieToken) return cookieToken;

  const header = request.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return null;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = readAccessToken(request);
  if (!token) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(401).send(fail('UNAUTHENTICATED', err.message));
      return;
    }
    reply.status(401).send(fail('UNAUTHENTICATED', 'Invalid access token'));
    return;
  }

  const user = await getUserForRequest(payload.sub);
  if (!user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'User not found or inactive'));
    return;
  }

  request.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    roleId: user.roleId ?? null,
    fullNameLatin: user.fullNameLatin,
    fullNameArabic: user.fullNameArabic,
    lastLogin: user.lastLogin,
  };
}

export function requireRole(...allowed: UserRole[]): preHandlerHookHandler {
  return async (request, reply) => {
    if (!request.user) {
      reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
      return;
    }
    if (!allowed.includes(request.user.role)) {
      reply.status(403).send(fail('FORBIDDEN', 'Insufficient permissions'));
      return;
    }
  };
}
