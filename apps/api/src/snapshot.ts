/**
 * Veritabanı anlık görüntüsü — sunucular arası taşıma (ör. yerel → Coolify) için.
 *
 *   Dışa aktarma:  DATABASE_URL=… node dist/snapshot.js export > snapshot.b64
 *   İçe aktarma:   RESTORE_SNAPSHOT_B64=<dosya içeriği> node dist/snapshot.js restore
 *
 * Çıktı gzip'li JSON'un base64'üdür. İçe aktarma yalnızca hedefte hiç kullanıcı yokken
 * çalışır (mevcut veriyi asla ezmez); değişken tanımlı değilse hiçbir şey yapmaz. Oturumlar
 * ve push abonelikleri taşınmaz (kullanıcılar yeniden giriş yapar). Otomatik artan kimlikler
 * (okumalar, loglar) hedefte yeniden üretilir. LLU kimlik bilgileri şifreli taşınır; hedefte
 * aynı ENCRYPTION_KEY kullanılmalıdır.
 */
import { gunzipSync, gzipSync } from 'node:zlib';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createPrisma } from './lib/prisma.js';

const VERSION = 1;

/** Yabancı anahtar sırasına göre tablolar; `omit` hedefte yeniden üretilen sütunlar. */
const TABLES = [
  { key: 'users', model: 'user', omit: [] },
  { key: 'consents', model: 'consent', omit: [] },
  { key: 'lluAccounts', model: 'lluAccount', omit: [] },
  { key: 'patients', model: 'patient', omit: [] },
  { key: 'patientAccess', model: 'patientAccess', omit: [] },
  { key: 'sensors', model: 'sensor', omit: [] },
  { key: 'readings', model: 'reading', omit: ['id'] },
  { key: 'logbookEntries', model: 'logbookEntry', omit: ['id'] },
  { key: 'notes', model: 'note', omit: [] },
  { key: 'alertRules', model: 'alertRule', omit: [] },
  { key: 'alertEvents', model: 'alertEvent', omit: [] },
  { key: 'collectorRuns', model: 'collectorRun', omit: ['id'] },
  { key: 'auditLogs', model: 'auditLog', omit: ['id'] },
  { key: 'settings', model: 'setting', omit: [] },
] as const;

type Row = Record<string, unknown>;
interface Snapshot {
  version: number;
  createdAt: string;
  tables: Record<string, Row[]>;
}

type Delegate = {
  findMany: () => Promise<Row[]>;
  createMany: (args: { data: Row[] }) => Promise<{ count: number }>;
};
const delegate = (db: PrismaClient | Prisma.TransactionClient, model: string) =>
  (db as unknown as Record<string, Delegate>)[model] as Delegate;

/** JSON'a güvenli: BigInt → string, Decimal → string; atlanan sütunlar çıkarılır. */
function serialize(row: Row, omit: readonly string[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (omit.includes(k)) continue;
    if (typeof v === 'bigint') out[k] = v.toString();
    else if (v instanceof Prisma.Decimal) out[k] = v.toString();
    else out[k] = v;
  }
  return out;
}

export async function exportSnapshot(prisma: PrismaClient): Promise<string> {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) {
    const rows = await delegate(prisma, t.model).findMany();
    tables[t.key] = rows.map((r) => serialize(r, t.omit));
  }
  const snap: Snapshot = { version: VERSION, createdAt: new Date().toISOString(), tables };
  return gzipSync(Buffer.from(JSON.stringify(snap))).toString('base64');
}

export function decodeSnapshot(b64: string): Snapshot {
  const snap = JSON.parse(
    gunzipSync(Buffer.from(b64.trim(), 'base64')).toString('utf8'),
  ) as Snapshot;
  if (snap?.version !== VERSION || typeof snap.tables !== 'object') {
    throw new Error(`Desteklenmeyen anlık görüntü sürümü: ${String(snap?.version)}`);
  }
  return snap;
}

/** Hedef boşsa içe aktarır; aktarılan satır sayılarını (ya da atlama nedenini) döndürür. */
export async function restoreSnapshot(
  prisma: PrismaClient,
  b64: string,
): Promise<{ restored: boolean; reason?: string; counts: Record<string, number> }> {
  if ((await prisma.user.count()) > 0) {
    return { restored: false, reason: 'hedef veritabanında zaten kullanıcı var', counts: {} };
  }
  const snap = decodeSnapshot(b64);
  const counts: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        const rows = (snap.tables[t.key] ?? []).map((r) => {
          const copy = { ...r };
          for (const col of t.omit) delete copy[col];
          if (t.key === 'auditLogs' && copy.meta === null) copy.meta = Prisma.JsonNull;
          return copy;
        });
        counts[t.key] = rows.length
          ? (await delegate(tx, t.model).createMany({ data: rows })).count
          : 0;
      }
    },
    { timeout: 120_000 },
  );
  return { restored: true, counts };
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const prisma = createPrisma();
  try {
    if (mode === 'export') {
      process.stdout.write(`${await exportSnapshot(prisma)}\n`);
    } else if (mode === 'restore') {
      const b64 = process.env.RESTORE_SNAPSHOT_B64;
      if (!b64) return;
      const r = await restoreSnapshot(prisma, b64);
      process.stdout.write(
        `${JSON.stringify({ msg: r.restored ? 'anlık görüntü içe aktarıldı' : 'içe aktarma atlandı', ...r })}\n`,
      );
    } else {
      throw new Error('Kullanım: snapshot.js export|restore');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('snapshot.js') || process.argv[1]?.endsWith('snapshot.ts')) {
  main().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
