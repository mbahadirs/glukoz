import { PrismaClient } from '@prisma/client';

export function createPrisma(url?: string): PrismaClient {
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

export type { PrismaClient };
