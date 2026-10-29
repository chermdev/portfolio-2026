import { useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useId } from 'react';
import { Input } from '@portfolio/ui/components/input';
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
