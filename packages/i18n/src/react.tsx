import { createContext, useContext, type ReactNode } from 'react';
import { translate, type Locale } from './index.ts';
const LocaleContext = createContext<Locale>('en');
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return { locale, t: (text: string, values?: Record<string, string | number>) => translate(text, locale, values) };
}
