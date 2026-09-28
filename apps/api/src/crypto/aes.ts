import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM yardımcıları. Biçim: `v1:iv:tag:ciphertext` (base64).
 * Sürüm öneki anahtar rotasyonu içindir; yeni anahtar eklenince `keys` haritasına eklenir.
 */
const CURRENT_VERSION = 'v1';

export class Cipher {
  private readonly keys: ReadonlyMap<string, Buffer>;

  constructor(keyBase64: string, previous: Record<string, string> = {}) {
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY 32 bayt olmalı');
    const entries: Array<[string, Buffer]> = Object.entries(previous).map(([v, k]) => [
      v,
      Buffer.from(k, 'base64'),
    ]);
    this.keys = new Map([...entries, [CURRENT_VERSION, key]]);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(CURRENT_VERSION) as Buffer, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      CURRENT_VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ct.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, ctB64] = payload.split(':');
    const key = version ? this.keys.get(version) : undefined;
    if (!key || !ivB64 || !tagB64 || ctB64 === undefined)
      throw new Error('Şifreli veri biçimi geçersiz');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
