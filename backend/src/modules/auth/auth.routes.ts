import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from './auth.middleware.js';
import {
  AuthError,
  login,
  logout,
  permissionsForUser,
  refresh,
  toUserSummary,
  getUserForRequest,
  type IssuedTokens,
} from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email').max(254),
  password: z.string().min(1, 'Password is required').max(200),
  rememberMe: z.boolean().optional(),
});

type RateLimitBucket = { count: number; windowStart: number };
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 5;
const failedLoginByEmail = new Map<string, RateLimitBucket>();

function checkRateLimit(emailKey: string): { limited: boolean } {
  const now = Date.now();
  const bucket = failedLoginByEmail.get(emailKey);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    return { limited: false };
  }
  return { limited: bucket.count >= RATE_LIMIT_MAX };
}

function recordFailedLogin(emailKey: string): void {
  const now = Date.now();
  const bucket = failedLoginByEmail.get(emailKey);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    failedLoginByEmail.set(emailKey, { count: 1, windowStart: now });
    return;
  }
  bucket.count += 1;
}

function clearFailedLogins(emailKey: string): void {
  failedLoginByEmail.delete(emailKey);
}

function setAuthCookies(reply: FastifyReply, tokens: IssuedTokens): void {
  const env = getEnv();
  const baseOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
  };
  reply.setCookie('access_token', tokens.accessToken, {
    ...baseOptions,
    maxAge: Math.floor(tokens.accessMaxAgeMs / 1000),
  });
  reply.setCookie('refresh_token', tokens.refreshToken, {
    ...baseOptions,
    maxAge: Math.floor(tokens.refreshMaxAgeMs / 1000),
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  const env = getEnv();
  const baseOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
  };
  reply.clearCookie('access_token', baseOptions);
  reply.clearCookie('refresh_token', baseOptions);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(422)
        .send(
          fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
        );
    }
    const { email, password, rememberMe } = parsed.data;
    const emailKey = email.trim().toLowerCase();

    const { limited } = checkRateLimit(emailKey);
    if (limited) {
      request.log.warn({ email: emailKey, ip: request.ip }, 'login rate limited');
      return reply
        .status(429)
        .send(fail('RATE_LIMITED', 'Too many failed attempts. Try again in 15 minutes.'));
    }

    try {
      const result = await login(email, password, {
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
        rememberMe: rememberMe === true,
      });

      clearFailedLogins(emailKey);
      setAuthCookies(reply, result.tokens);
      return reply.send(ok({ user: result.user }));
    } catch (err) {
      if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
        recordFailedLogin(emailKey);
        request.log.warn(
          { email: emailKey, ip: request.ip, code: err.code },
          'auth failure: invalid credentials',
        );
        return reply.status(401).send(fail('INVALID_CREDENTIALS', 'Invalid email or password'));
      }
      throw err;
    }
  });

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies?.refresh_token;
    if (!token) {
      clearAuthCookies(reply);
      return reply.status(401).send(fail('REFRESH_INVALID', 'Missing refresh token'));
    }

    try {
      const result = await refresh(token, {
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });
      setAuthCookies(reply, result.tokens);
      return reply.send(ok({ user: result.user }));
    } catch (err) {
      if (err instanceof AuthError) {
        clearAuthCookies(reply);
        const status = err.statusCode || 401;
        const code =
          err.code === 'REFRESH_EXPIRED'
            ? 'REFRESH_EXPIRED'
            : err.code === 'UNAUTHENTICATED'
              ? 'UNAUTHENTICATED'
              : 'REFRESH_INVALID';
        request.log.warn({ ip: request.ip, code }, 'auth failure: refresh');
        return reply.status(status).send(fail(code, err.message));
      }
      throw err;
    }
  });

  app.post('/logout', async (request, reply) => {
    const token = request.cookies?.refresh_token;
    try {
      await logout(token);
    } catch (err) {
      request.log.warn({ err }, 'logout cleanup failed (ignored)');
    }
    clearAuthCookies(reply);
    return reply.send(ok({ message: 'Logged out' }));
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    }
    const freshUser = await getUserForRequest(request.user.id);
    if (!freshUser) {
      return reply.status(401).send(fail('UNAUTHENTICATED', 'User not found or inactive'));
    }

    // Get dynamic permissions from database
    const permissions = await permissionsForUser(freshUser);

    return reply.send(
      ok({
        user: toUserSummary(freshUser),
        permissions,
      }),
    );
  });
}
