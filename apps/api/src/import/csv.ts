/** Küçük RFC 4180 CSV ayrıştırıcı (tırnaklı alanlar, alan içi satır sonu). */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function detectDelimiter(line: string): string {
  const counts = [',', ';', '\t'].map((d) => ({ d, n: line.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0]?.d ?? ',';
}

/** CSV enjeksiyonuna karşı (=, +, -, @ ile başlayan metin) ve `;` ayırıcıya uygun kaçış. */
export function csvCell(value: string | number | null | undefined, delimiter = ';'): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
