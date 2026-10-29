import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale, localizePath } from '@portfolio/i18n';
import { useState } from 'react';
import { ArrowUpRight, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { site } from '../lib/site';
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetHeader } from '@portfolio/ui/components/sheet';
function HeaderContent({ pathname, portfolioBase = '' }: { pathname: string; notesHref: string; portfolioBase?: string }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  function toggleTheme() {
    const block = document.createElement('style');
    block.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(block);
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--background').trim());
    void document.documentElement.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => block.remove()));
    window.dispatchEvent(new Event('themechange'));
  }
  const links = [{ href: `${portfolioBase}/projects`, label: t("Projects") }, { href: `${portfolioBase}/tools`, label: t("Tools") }, { href: `${portfolioBase}/#about`, label: t("About") }].map(link => ({ ...link, href: localizePath(link.href, locale) }));
  return <header className="page-shell relative z-20"><div className="flex h-24 items-center justify-between gap-6 border-b">
    <a href={localizePath(`${portfolioBase}/`, locale)} aria-label={t("chermdev home")} className="text-xl font-semibold tracking-tight">chermdev<span className="text-muted-foreground">.</span></a>
    <nav aria-label={t("Main navigation")} className="hidden items-center rounded-full bg-muted/60 p-1 md:flex">{links.map(link => <a key={link.label} href={link.href} className="nav-link" aria-current={pathname.startsWith(link.href) ? 'page' : undefined}>{link.label}</a>)}</nav>
    <div className="flex items-center gap-2 sm:gap-3">
      <a href={localizePath(pathname, locale === 'en' ? 'es' : 'en')} hrefLang={locale === 'en' ? 'es' : 'en'} lang={locale === 'en' ? 'es' : 'en'} aria-label={locale === 'en' ? 'Cambiar a español' : 'Switch to English'} className="text-link px-2">{locale === 'en' ? 'ES' : 'EN'}</a>
      <Button variant="ghost" size="icon" aria-label={t("Toggle light and dark theme")} onClick={toggleTheme}><span className="relative flex size-5 items-center justify-center"><Sun className="theme-icon theme-sun absolute" /><Moon className="theme-icon theme-moon absolute" /></span></Button>
      <a href={site.linkedin} className="text-link hidden sm:inline-flex"> {t("Let’s connect")} <ArrowUpRight size={16} strokeWidth={1.5} /></a>
      <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label={t("Open navigation")}><Menu /></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle> {t("Explore chermdev")} </SheetTitle></SheetHeader><nav aria-label={t("Mobile navigation")} className="flex flex-col gap-2 p-4">{links.map(link => <a key={link.label} href={link.href} onClick={() => setOpen(false)} className="nav-link">{link.label}</a>)}<a href="https://github.com/chermdev" className="nav-link inline-flex items-center gap-2">GitHub <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} /></a></nav></SheetContent></Sheet>
    </div>
  </div></header>;
}

export default function Header({ locale = 'en', ...props }: { pathname: string; notesHref: string; portfolioBase?: string } & { locale?: Locale }) {
  return <LocaleProvider locale={locale}><HeaderContent {...props} /></LocaleProvider>;
}
