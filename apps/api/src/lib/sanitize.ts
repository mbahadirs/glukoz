/**
 * Saklanan/gösterilen hata metinlerinden olası kimlik bilgilerini temizler
 * (e-posta, Bearer token, uzun hex/base64 dizileri). Log redaksiyonu alan bazlıdır;
 * serbest metin için bu ek güvence kullanılır.
 */
export function sanitizeErrorText(text: string, maxLength = 500): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-posta]')
    .replace(/bearer\s+[\w.~+/=-]+/gi, 'Bearer [gizli]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[gizli]')
    .replace(/\b[\w-]{40,}\b/g, '[gizli]')
    .slice(0, maxLength);
}
