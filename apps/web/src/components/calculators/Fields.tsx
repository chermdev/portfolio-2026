import { useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useEffect, useId, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@portfolio/ui/components/input';
import { Button } from '@portfolio/ui/components/button';
import { Badge } from '@portfolio/ui/components/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@portfolio/ui/components/collapsible';
import { Field, FieldLabel, FieldDescription, FieldError } from '@portfolio/ui/components/field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@portfolio/ui/components/select';
export function NumberField({ label, value, onChange, suffix, hint, min = 0, max = 1e9, step = 0.01 }: { label: string; value: string | number; onChange: (value: string) => void; suffix?: string; hint?: string; min?: number; max?: number; step?: number }) {
  const id = useId();
  const { t } = useTranslation();
  const invalid = value === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max || (step >= 1 && Math.abs((Number(value) - min) / step - Math.round((Number(value) - min) / step)) > 1e-6);
  return <Field data-invalid={invalid || undefined}><FieldLabel htmlFor={id}>{label}{suffix && <span className="ml-auto text-xs text-muted-foreground">{suffix}</span>}</FieldLabel><Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined} />{hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}{invalid && <FieldError id={`${id}-error`}>{t('Enter a number from {min} to {max}{step}.', { min, max, step: step >= 1 ? ' ' + t('in steps of {step}', { step }) : '' })}</FieldError>}</Field>;
}
export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>;
}
export const money = (value: number, currency: string, locale: Locale = 'en') => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
export function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="data-row"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
const isAmountInvalid = (value: string) => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e9;
/** The one input that matters most, set large like a calculator display, with optional quick amounts. */
export function AmountField({ label, value, onChange, currency, quick = [], hint }: { label: string; value: string; onChange: (value: string) => void; currency: string; quick?: number[]; hint?: string }) {
  const id = useId();
  const { t, locale } = useTranslation();
  const invalid = isAmountInvalid(value);
  return <Field data-invalid={invalid || undefined}><FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="amount-field"><input id={id} className="amount-input" type="number" inputMode="decimal" min={0} max={1e9} step={0.01} value={value} onChange={event => onChange(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined} /><span className="meta">{currency}</span></div>
    {quick.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label={t("Quick amounts")}>{quick.map(amount => <Button key={amount} type="button" size="sm" variant={Number(value) === amount ? 'secondary' : 'outline'} className="rounded-full" aria-pressed={Number(value) === amount} onClick={() => onChange(String(amount))}>{new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)}</Button>)}</div>}
    {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
    {invalid && <FieldError id={`${id}-error`}>{t('Enter a number from {min} to {max}{step}.', { min: 0, max: 1e9, step: '' })}</FieldError>}</Field>;
}
/** Secondary settings, closed by default; the summary keeps the current values visible. */
export function Settings({ title, summary, edited, children }: { title: string; summary: string; edited?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
    <CollapsibleTrigger className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left"><SlidersHorizontal aria-hidden="true" className="shrink-0" size={18} strokeWidth={1.5} /><span className="flex min-w-0 flex-col"><span className="flex items-center gap-2 font-medium">{title}{edited && <Badge variant="secondary">{t("Edited")}</Badge>}</span><span className="meta truncate">{summary}</span></span><ChevronDown aria-hidden="true" className="ml-auto shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180" size={18} strokeWidth={1.5} /></CollapsibleTrigger>
    <CollapsibleContent className="border-t px-4 py-5">{children}</CollapsibleContent>
  </Collapsible>;
}
export type ReceiptLine = { label: string; value: string; sign?: '−' | '+' | '=' };
export type ReceiptSegment = { label: string; value: number; color: string };
/** The result read as a receipt: where the money goes (bar), the itemized math, and the formula with the user's numbers. */
export function Receipt({ lines = [], segments = [], formula = [] }: { lines?: ReceiptLine[]; segments?: ReceiptSegment[]; formula?: string[] }) {
  const { locale } = useTranslation();
  const shown = segments.filter(segment => segment.value > 0);
  const total = shown.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value / total);
  return <div className="flex flex-col gap-5">
    {total > 0 && segments.every(segment => segment.value >= 0) && <div><div className="receipt-bar" role="img" aria-label={shown.map(segment => `${segment.label} ${share(segment.value)}`).join(', ')}>{shown.map(segment => <span key={segment.label} style={{ flexGrow: segment.value, background: segment.color }} />)}</div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">{shown.map(segment => <li key={segment.label} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: segment.color }} />{segment.label} {share(segment.value)}</li>)}</ul></div>}
    {lines.length > 0 && <dl className="receipt">{lines.map(line => <div key={line.label} className={line.sign === '=' ? 'receipt-row receipt-total' : 'receipt-row'}><dt>{line.sign && <span aria-hidden="true">{line.sign} </span>}{line.label}</dt><dd>{line.value}</dd></div>)}</dl>}
    {formula.length > 0 && <div className="receipt-formula">{formula.map(line => <p key={line}>{line}</p>)}</div>}
  </div>;
}
/** On small screens, keep the answer in view while the inputs are on screen and the full result is not. */
export function MobileResult({ label, value, inputs, result }: { label: string; value: string; inputs: RefObject<HTMLElement | null>; result: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ inputs: false, result: false });
  useEffect(() => {
    // The result counts as seen only when most of it is on screen, not when its top edge peeks in.
    const observer = new IntersectionObserver(entries => setState(previous => entries.reduce((next, entry) => entry.target === inputs.current ? { ...next, inputs: entry.isIntersecting } : { ...next, result: entry.intersectionRatio >= 0.6 }, previous)), { threshold: [0, 0.6, 1] });
    if (inputs.current) observer.observe(inputs.current);
    if (result.current) observer.observe(result.current);
    return () => observer.disconnect();
  }, [inputs, result]);
  const visible = state.inputs && !state.result;
  return <div className="mobile-result lg:hidden" data-visible={visible} aria-hidden={!visible}><div className="min-w-0"><p className="meta">{label}</p><p className="truncate text-xl font-medium tabular-nums">{value}</p></div><Button size="sm" variant="outline" tabIndex={visible ? 0 : -1} onClick={() => result.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}>{t("See breakdown")}</Button></div>;
}
/** Extra answers derived from the same inputs, so the result says more than one number. */
export function Insights({ items }: { items: { label: string; value: string }[] }) {
  return <dl className="grid gap-3 @xl:grid-cols-3">{items.map(item => <div key={item.label} className="rounded-xl border bg-card p-4"><dt className="text-xs leading-5 text-muted-foreground">{item.label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{item.value}</dd></div>)}</dl>;
}
