import { TFn } from '@/lib/i18n';

export function timeAgo(iso: string, t: TFn): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return `${min} ${t('minAgo')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('hrAgo')}`;
  const day = Math.floor(hr / 24);
  return `${day} ${t('dayAgo')}`;
}
