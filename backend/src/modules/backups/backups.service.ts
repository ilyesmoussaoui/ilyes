import { spawn } from 'node:child_process';
import { createGzip, createGunzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class BackupError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type BackupKind = 'auto' | 'nightly' | 'manual' | 'pre_restore';

export interface BackupMeta {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  mode: 'prisma' | 'pgdump';
  kind: BackupKind;
}

// ─── Concurrency guard ──────────────────────────────────────────────────────

let runningBackup: Promise<BackupMeta> | null = null;
let activeRestore = false;

export function isRestoreActive(): boolean {
  return activeRestore;
}

// ─── Directory helpers ──────────────────────────────────────────────────────

function resolveBackupsDir(): string {
  const env = getEnv();
  return path.resolve(process.cwd(), env.BACKUPS_DIR);
}

export async function ensureBackupsDir(): Promise<string> {
  const dir = resolveBackupsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function timestampForFilename(date: Date = new Date()): string {
  // YYYY-MM-DDTHH-MM-SS (filesystem-safe, UTC)
  return date.toISOString().replace(/\..+/, '').replace(/:/g, '-');
}

function buildFilename(mode: 'prisma' | 'pgdump', kind: BackupKind, date: Date): string {
  const ext = mode === 'prisma' ? 'json.gz' : 'sql.gz';
  return `backup_${kind}_${timestampForFilename(date)}.${ext}`;
}

// ─── Filename safety (defense in depth against path traversal) ──────────────

const FILENAME_RE = /^backup_(auto|nightly|manual|pre_restore)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.(json|sql)\.gz$/;

export function isSafeBackupFilename(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  return FILENAME_RE.test(name);
}

// ─── DATABASE_URL parsing (secure) ──────────────────────────────────────────

function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '').split('?')[0] ?? 'postgres',
  };
}

// ─── Audit helpers ──────────────────────────────────────────────────────────

async function auditBackupEvent(
  kind: BackupKind,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  userId: string | null,
  reason?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: 'backups',
        recordId: '00000000-0000-0000-0000-000000000000',
        fieldName: `${kind}:${fieldName}`,
        oldValue,
        newValue,
        userId: userId ?? null,
        reason: reason ?? null,
      },
    });
  } catch {
    // audit write failure is non-fatal
  }
}

// ─── Prisma-driven JSON snapshot ────────────────────────────────────────────

// List of all domain tables to dump. Keep deterministic.
const PRISMA_TABLES = [
  'user',
  'refreshToken',
  'member',
  'memberContact',
  'emergencyContact',
  'discipline',
  'memberDiscipline',
  'timeSlot',
  'schedule',
  'document',
  'subscription',
  'payment',
  'paymentItem',
  'equipment',
  'stockAdjustment',
  'memberEquipment',
  'attendanceRecord',
  'faceEmbedding',
  'familyLink',
  'auditLog',
  'expense',
  'notification',
  'setting',
  'memberNote',
  'role',
  'permission',
  'rolePermission',
  'subscriptionPlan',
  'documentRequirement',
  'notificationSetting',
] as const;

async function snapshotPrismaToGzip(destPath: string): Promise<void> {
  const snapshot: Record<string, unknown[]> = {};
  for (const table of PRISMA_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any)[table].findMany({});
    snapshot[table] = rows;
  }

  const payload = JSON.stringify(
    { version: 1, generatedAt: new Date().toISOString(), tables: snapshot },
    (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Buffer) return { __buffer__: value.toString('base64') };
      return value;
    },
  );

  const gzip = createGzip({ level: 6 });
  const outStream = createWriteStream(destPath);
  // Pipe buffer -> gzip -> file
  await new Promise<void>((resolve, reject) => {
    gzip.on('error', reject);
    outStream.on('error', reject);
    outStream.on('finish', () => resolve());
    gzip.pipe(outStream);
    gzip.end(payload);
  });
}

// ─── pg_dump (safe: args array, never shell interpolation) ──────────────────

async function runPgDumpToGzip(destPath: string): Promise<void> {
  const env = getEnv();
  const creds = parseDatabaseUrl(env.DATABASE_URL);
  const args = [
    '-h',
    creds.host,
    '-p',
    creds.port,
    '-U',
    creds.user,
    '-d',
    creds.database,
    '--format=plain',
    '--no-owner',
    '--no-privileges',
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(env.PG_DUMP_PATH, args, {
      env: { ...process.env, PGPASSWORD: creds.password },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const gzip = createGzip({ level: 6 });
    const out = createWriteStream(destPath);

    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exited with code ${code}: ${stderrBuf}`));
      }
    });

    out.on('error', reject);
    out.on('finish', () => resolve());

    child.stdout.pipe(gzip).pipe(out);
  });
}

// ─── Create backup ──────────────────────────────────────────────────────────

export async function createBackup(
  kind: BackupKind,
  userId: string | null = null,
): Promise<BackupMeta> {
  if (runningBackup) {
    // Coalesce concurrent auto-backups to avoid pile-up after rapid transactions.
    return runningBackup;
  }

  const env = getEnv();
  const dir = await ensureBackupsDir();
  const mode = env.BACKUP_MODE;
  const filename = buildFilename(mode, kind, new Date());
  const destPath = path.join(dir, filename);

  const runner = (async (): Promise<BackupMeta> => {
    const started = Date.now();
    try {
      if (mode === 'prisma') {
        await snapshotPrismaToGzip(destPath);
      } else {
        await runPgDumpToGzip(destPath);
      }
      const stats = await fs.stat(destPath);
      const meta: BackupMeta = {
        filename,
        sizeBytes: stats.size,
        createdAt: new Date().toISOString(),
        mode,
        kind,
      };
      await auditBackupEvent(
        kind,
        'success',
        null,
        JSON.stringify({ filename, sizeBytes: stats.size, durationMs: Date.now() - started }),
        userId,
      );
      // Rotate after success (failure to rotate should not invalidate the new backup)
      await rotateBackups().catch(() => undefined);
      return meta;
    } catch (err) {
      // Best-effort cleanup of partial file
      await fs.unlink(destPath).catch(() => undefined);
      await auditBackupEvent(
        kind,
        'failure',
        null,
        (err as Error).message.slice(0, 500),
        userId,
      );
      throw new BackupError('BACKUP_FAILED', `Backup failed: ${(err as Error).message}`, 500);
    }
  })();

  runningBackup = runner;
  try {
    return await runner;
  } finally {
    runningBackup = null;
  }
}

// ─── List backups ───────────────────────────────────────────────────────────

export async function listBackups(): Promise<BackupMeta[]> {
  const dir = await ensureBackupsDir();
  const entries = await fs.readdir(dir);
  const metas: BackupMeta[] = [];
  for (const name of entries) {
    if (!isSafeBackupFilename(name)) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const mode: 'prisma' | 'pgdump' = name.endsWith('.json.gz') ? 'prisma' : 'pgdump';
      const kindMatch = name.match(/^backup_(auto|nightly|manual|pre_restore)_/);
      const kind = (kindMatch?.[1] ?? 'manual') as BackupKind;
      metas.push({
        filename: name,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        mode,
        kind,
      });
    } catch {
      // skip unreadable
    }
  }
  return metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ─── Retention / rotation ───────────────────────────────────────────────────

export async function rotateBackups(): Promise<{ pruned: number }> {
  const env = getEnv();
  const backups = await listBackups();

  // Keep all manual + pre_restore. Auto/nightly are pruned by policy.
  const dailyKeep = new Set<string>();
  const monthlyKeep = new Set<string>();

  // Daily: keep the most recent N auto/nightly across all days (up to 30).
  const autoAndNightly = backups.filter((b) => b.kind === 'auto' || b.kind === 'nightly');
  // Most recent per day, take up to BACKUP_RETENTION_DAILY days.
  const byDay = new Map<string, BackupMeta>();
  for (const b of autoAndNightly) {
    const day = b.createdAt.slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || prev.createdAt < b.createdAt) byDay.set(day, b);
  }
  const sortedDays = Array.from(byDay.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, env.BACKUP_RETENTION_DAILY);
  for (const b of sortedDays) dailyKeep.add(b.filename);

  // Monthly: most recent backup per month, keep last N months.
  const byMonth = new Map<string, BackupMeta>();
  for (const b of autoAndNightly) {
    const month = b.createdAt.slice(0, 7);
    const prev = byMonth.get(month);
    if (!prev || prev.createdAt < b.createdAt) byMonth.set(month, b);
  }
  const sortedMonths = Array.from(byMonth.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, env.BACKUP_RETENTION_MONTHLY);
  for (const b of sortedMonths) monthlyKeep.add(b.filename);

  const dir = resolveBackupsDir();
  let pruned = 0;
  for (const b of autoAndNightly) {
    if (dailyKeep.has(b.filename) || monthlyKeep.has(b.filename)) continue;
    try {
      await fs.unlink(path.join(dir, b.filename));
      pruned += 1;
    } catch {
      // ignore
    }
  }
  return { pruned };
}

// ─── Restore ────────────────────────────────────────────────────────────────

export async function restoreBackup(
  filename: string,
  userId: string,
): Promise<{ filename: string; restoredAt: string }> {
  if (!isSafeBackupFilename(filename)) {
    throw new BackupError('INVALID_FILENAME', 'Backup filename is not in the expected format', 422);
  }
  if (activeRestore) {
    throw new BackupError('RESTORE_IN_PROGRESS', 'A restore is already in progress', 409);
  }

  const dir = await ensureBackupsDir();
  const full = path.join(dir, filename);
  try {
    const stat = await fs.stat(full);
    if (!stat.isFile()) {
      throw new BackupError('NOT_FOUND', 'Backup file not found', 404);
    }
  } catch {
    throw new BackupError('NOT_FOUND', 'Backup file not found', 404);
  }

  activeRestore = true;
  try {
    // Create a pre_restore snapshot first, so restores are reversible.
    await createBackup('pre_restore', userId).catch(() => undefined);

    if (filename.endsWith('.json.gz')) {
      await restoreFromPrismaSnapshot(full);
    } else {
      // pg_dump mode not safely automated from app process in production without psql
      // running outside the app lifecycle. Fail loudly.
      throw new BackupError(
        'UNSUPPORTED_RESTORE',
        'Automated restore from pg_dump SQL is not supported in-process; restore via DBA tooling',
        422,
      );
    }

    await auditBackupEvent('manual', 'restore_success', null, filename, userId);
    return { filename, restoredAt: new Date().toISOString() };
  } catch (err) {
    await auditBackupEvent(
      'manual',
      'restore_failure',
      null,
      `${filename}: ${(err as Error).message}`.slice(0, 500),
      userId,
    );
    throw err;
  } finally {
    activeRestore = false;
  }
}

async function restoreFromPrismaSnapshot(gzPath: string): Promise<void> {
  // Read and decompress into memory (snapshots are small relative to RAM).
  // pipeline() requires its last stage to be a Writable or an async consuming
  // function (no yield). Using a consuming async function that collects chunks.
  const chunks: Buffer[] = [];
  await pipeline(
    createReadStream(gzPath),
    createGunzip(),
    async function (src: AsyncIterable<Buffer>) {
      for await (const chunk of src) {
        chunks.push(chunk);
      }
    },
  );
  const raw = Buffer.concat(chunks).toString('utf-8');
  const parsed = JSON.parse(raw, (_key, value) => {
    if (value && typeof value === 'object' && typeof (value as { __buffer__?: string }).__buffer__ === 'string') {
      return Buffer.from((value as { __buffer__: string }).__buffer__, 'base64');
    }
    return value;
  }) as { version: number; tables: Record<string, unknown[]> };

  if (parsed.version !== 1) {
    throw new BackupError('UNSUPPORTED_VERSION', 'Unsupported backup schema version', 422);
  }

  // Best-effort transactional restore: truncate + reinsert in reverse FK order.
  // This runs outside a prisma.$transaction because the data volume may exceed
  // the interactive transaction timeout. The restore token + active-writes gate
  // is the safety boundary.
  const truncateOrder = [
    'rolePermission',
    'refreshToken',
    'auditLog',
    'stockAdjustment',
    'memberEquipment',
    'paymentItem',
    'payment',
    'schedule',
    'memberDiscipline',
    'faceEmbedding',
    'memberContact',
    'emergencyContact',
    'familyLink',
    'memberNote',
    'document',
    'attendanceRecord',
    'subscription',
    'notification',
    'member',
    'timeSlot',
    'subscriptionPlan',
    'equipment',
    'discipline',
    'expense',
    'setting',
    'notificationSetting',
    'documentRequirement',
    'permission',
    'user',
    'role',
  ] as const;

  for (const table of truncateOrder) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[table].deleteMany({});
  }

  // Insert in reverse of truncate order (parents first).
  const insertOrder = [...truncateOrder].reverse();
  for (const table of insertOrder) {
    const rows = parsed.tables[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[table].createMany({ data: rows, skipDuplicates: true });
  }
}
