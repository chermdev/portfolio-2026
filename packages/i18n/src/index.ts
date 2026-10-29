import { es } from './es.ts';
export type Locale = 'en' | 'es';
export const localeFromPath = (path: string): Locale => /^\/es(?:\/|$)/.test(path) ? 'es' : 'en';
export function localizePath(path: string, locale: Locale) {
  if (/^https?:\/\//.test(path)) { const url = new URL(path); url.pathname = localizePath(url.pathname, locale); return url.href; }
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (/^\/es\/404\/?$/.test(path) && locale === 'en') return '/404.html';
  if (path === '/404.html' && locale === 'es') return '/es/404/';
  const bare = path.replace(/^\/es(?=\/|$)/, '') || '/';
  return locale === 'es' ? `/es${bare === '/' ? '/' : bare}` : bare;
}
export function translate(text: string, locale: Locale, values: Record<string, string | number> = {}): string {
  const key = text.replace(/\s+/g, ' ').trim();
  let result = locale === 'es' ? es[key] ?? key : key;
  if (locale === 'es' && result === key && key.endsWith(' | chermdev')) result = `${es[key.slice(0, -11)] ?? key.slice(0, -11)} | chermdev`;
  if (locale === 'es' && result === key) {
    if (key.endsWith(' — developer tools and experiments by chermdev')) return translate(key.replace(' — developer tools and experiments by chermdev', ''), locale) + ' — herramientas y experimentos de chermdev';
    if (key.endsWith(' — chermdev')) return translate(key.replace(' — chermdev', ''), locale) + ' — chermdev';
    const deposit = key.match(/^Deposit month must be between 1 and (.+)\.$/);
    const range = key.match(/^(.+) must be between (.+) and (.+)\.$/);
    if (deposit) result = translate('Deposit month must be between 1 and {max}.', locale, { max: deposit[1] });
    else if (range) result = translate('{name} must be between {min} and {max}.', locale, { name: translate(range[1], locale), min: range[2], max: range[3] });
  }
  return result.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
