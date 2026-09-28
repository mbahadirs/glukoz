import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
// Dil i18n/index.ts'te arayüz diline göre ayarlanır (burada sabitlenmez).

export default dayjs;

export function todayIn(tz: string): string {
  return dayjs().tz(tz).format('YYYY-MM-DD');
}

export function formatTime(ts: number | string, tz: string, fmt = 'HH:mm'): string {
  return dayjs(ts).tz(tz).format(fmt);
}
