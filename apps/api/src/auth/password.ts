import { hash, verify } from '@node-rs/argon2';

/** Argon2id (kütüphane varsayılanı), memoryCost 19 MiB, timeCost 2. */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

let dummyHash: Promise<string> | null = null;

/** Kullanıcı yoksa da aynı süreyi harcar (kullanıcı adı keşfini zorlaştırır). */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    dummyHash ??= hash('dummy-password-for-timing', OPTIONS);
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return verify(stored, password).catch(() => false);
}
