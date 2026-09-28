import type { PrismaClient } from '@prisma/client';

/**
 * Hesap başına PG advisory lock (transaction seviyesinde). Kilit alınamazsa `null` döner.
 * Çoklu instance çalıştığında aynı hesabın iki kez toplanmasını engeller.
 */
export async function withAccountLock<T>(
  prisma: PrismaClient,
  accountId: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${'collector:' + accountId})) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { timeout: 180_000, maxWait: 10_000 },
  );
}
