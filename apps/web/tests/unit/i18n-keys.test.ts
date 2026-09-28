import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import tr from '../../src/i18n/tr.json';
import en from '../../src/i18n/en.json';

type Dict = { [k: string]: string | Dict };

function flatten(d: Dict, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') out.add(prefix + k.replace(/_(one|other)$/, ''));
    else for (const x of flatten(v, `${prefix}${k}.`)) out.add(x);
  }
  return out;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('i18n', () => {
  const trKeys = flatten(tr as Dict);
  const enKeys = flatten(en as Dict);
  it('tr ve en aynı anahtarlara sahip', () => {
    expect([...trKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !trKeys.has(k))).toEqual([]);
  });
  it('koddaki tüm sabit t() anahtarları tanımlı', () => {
    const used = new Set<string>();
    for (const file of sources(join(__dirname, '../../src'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g))
        used.add(m[1] as string);
    }
    expect(used.size).toBeGreaterThan(100);
    expect([...used].filter((k) => !trKeys.has(k))).toEqual([]);
  });
});
