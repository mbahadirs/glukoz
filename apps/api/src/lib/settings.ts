import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';

/** Çalışma zamanı ayarları: DB'deki `Setting` değeri env varsayılanını ezer. */
export class RuntimeSettings {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: Env,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  async lluProductVersion(): Promise<{ product: string; version: string }> {
    const [product, version] = await Promise.all([
      this.get('llu.product'),
      this.get('llu.version'),
    ]);
    return { product: product ?? this.env.LLU_PRODUCT, version: version ?? this.env.LLU_VERSION };
  }
}
