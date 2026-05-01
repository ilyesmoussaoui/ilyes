import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions, TokenExpiredError } from 'jsonwebtoken';
import type { Prisma, User, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import {
  ROLE_PERMISSIONS,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type SessionMeta,
  type UserSummary,
} from './auth.types.js';
import { getDynamicPermissions } from './rbac.middleware.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
const REMEMBER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8tMFyOk5x3J3HqKp6F.FfLOgkrHKEa';

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    roleId: user.roleId ?? null,
    fullNameLatin: user.fullNameLatin,
    fullNameArabic: user.fullNameArabic,
    lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
  };
}

export function permissionsForRole(role: UserRole): string[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Get dynamic permissions for a user based on their roleId.
 * Returns "resource:action" formatted strings.
 */
export async function permissionsForUser(user: User): Promise<string[]> {
  return getDynamicPermissions(user.roleId, user.role);
}

function signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  const env = getEnv();
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
}

function signRefreshToken(userId: string, jti: string, maxAgeMs: number): string {
  const env = getEnv();
  const payload: RefreshTokenPayload = { sub: userId, jti };
  const expiresIn = `${Math.floor(maxAgeMs / 1000)}s`;
  return jwt.sign(payload, env.REFRESH_SECRET, { expiresIn } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = getEnv();
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw new AuthError('UNAUTHENTICATED', 'Invalid or expired access token');
  }
}

function verifyRefreshSignature(token: string): RefreshTokenPayload {
  const env = getEnv();
  try {
    return jwt.verify(token, env.REFRESH_SECRET) as RefreshTokenPayload;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AuthError('REFRESH_EXPIRED', 'Refresh token expired');
    }
    throw new AuthError('REFRESH_INVALID', 'Refresh token invalid');
  }
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshMaxAgeMs: number;
  accessMaxAgeMs: number;
};

async function issueTokens(
  user: User,
  meta: SessionMeta,
  tx: Prisma.TransactionClient = prisma,
): Promise<IssuedTokens> {
  const jti = crypto.randomUUID();
  const refreshMaxAgeMs = meta.rememberMe ? REMEMBER_MAX_AGE_MS : SESSION_MAX_AGE_MS;
  const refreshToken = signRefreshToken(user.id, jti, refreshMaxAgeMs);
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshMaxAgeMs);

  await tx.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    refreshTokenId: jti,
    refreshMaxAgeMs,
    accessMaxAgeMs: ACCESS_MAX_AGE_MS,
  };
}

export type LoginResult = {
  user: UserSummary;
  tokens: IssuedTokens;
};

export async function login(
  email: string,
  password: string,
  meta: SessionMeta,
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
  });

  const eligible = user !== null && user.deletedAt === null && user.isActive;
  const targetHash = eligible ? user.passwordHash : DUMMY_HASH;
  const passwordOk = await verifyPassword(password, targetHash);

  if (!eligible || !passwordOk) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const tokens = await issueTokens(updated, meta);
  return { user: toUserSummary(updated), tokens };
}

export type RefreshResult = {
  user: UserSummary;
  tokens: IssuedTokens;
};

export async function refresh(
  refreshTokenRaw: string,
  meta: SessionMeta,
): Promise<RefreshResult> {
  const payload = verifyRefreshSignature(refreshTokenRaw);
  const tokenHash = hashRefreshToken(refreshTokenRaw);

  return prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.tokenHash !== tokenHash) {
      throw new AuthError('REFRESH_INVALID', 'Refresh token not recognized');
    }
    if (stored.revokedAt) {
      throw new AuthError('REFRESH_INVALID', 'Refresh token has been revoked');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('REFRESH_EXPIRED', 'Refresh token expired');
    }

    const user = await tx.user.findFirst({ where: { id: stored.userId } });
    if (!user || user.deletedAt !== null || !user.isActive) {
      throw new AuthError('UNAUTHENTICATED', 'User no longer active');
    }

    // Preserve original rememberMe preference: if stored token lifespan > 8h+1min,
    // it was created as a remember-me session.
    const storedLifespanMs = stored.expiresAt.getTime() - stored.createdAt.getTime();
    const preservedRememberMe = storedLifespanMs > SESSION_MAX_AGE_MS + 60 * 1000;
    const rotated = await issueTokens(
      user,
      { ...meta, rememberMe: preservedRememberMe },
      tx,
    );
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: rotated.refreshTokenId },
    });

    return { user: toUserSummary(user), tokens: rotated };
  });
}

export async function logout(refreshTokenRaw: string | undefined): Promise<void> {
  if (!refreshTokenRaw) return;
  const tokenHash = hashRefreshToken(refreshTokenRaw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserForRequest(id: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { id } });
  if (!user || user.deletedAt !== null || !user.isActive) return null;
  return user;
}
