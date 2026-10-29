import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { ArrowDownUp, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup, Field, FieldLabel } from '@portfolio/ui/components/field';
import { Switch } from '@portfolio/ui/components/switch';
import { Separator } from '@portfolio/ui/components/separator';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { stripePresets, stripeFees, grossForNet, type Currency, type RadarPlan, type FeeConfig } from '@portfolio/calculators';
import { NumberField, SelectField, ResultRow, money } from './Fields';
import { useStripeStore, useHydrateCalculator, feeDefaults as defaults, type Draft } from '../../stores/calculators';
function StripeCalculatorContent() {
  const { t, locale } = useTranslation();
  useHydrateCalculator(useStripeStore);
  const { values: { currency, plan, draft, international, conversion, mode, amount }, set, reset } = useStripeStore();
  const setCurrency = (value: Currency) => set('currency', value);
  const setPlan = (value: RadarPlan) => set('plan', value);
  const setDraft = (value: Draft | ((previous: Draft) => Draft)) => set('draft', value);
  const setInternational = (value: boolean) => set('international', value);
  const setConversion = (value: boolean) => set('conversion', value);
  const setMode = (value: string) => set('mode', value);
  const setAmount = (value: string) => set('amount', value);
  let result: ReturnType<typeof stripeFees> | undefined, error = '';
  const config = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value === '' ? NaN : Number(value)])) as FeeConfig;
  if (!international) config.international = 0;
  if (!conversion) config.conversion = 0;
  try {
    if (amount === '') throw new Error(t("Enter an amount to calculate."));
    const gross = mode === 'charge' ? Number(amount) : grossForNet(Number(amount), config);
    result = stripeFees(gross, config);
  } catch (err) { error = (err as Error).message; }
  const update = (key: keyof Draft, value: string) => setDraft(prev => ({ ...prev, [key]: value }));
  const changePreset = (value: string) => { const next = value as Currency; setCurrency(next); setDraft(defaults(next, plan)); };
  function changeMode(value: string) { if (!value) return; if (result) setAmount(String(value === 'charge' ? result.gross : Math.max(0, result.net))); setMode(value); }
  return <div className="grid items-start gap-8 lg:grid-cols-5">
    <div className="rounded-2xl border bg-card p-6 sm:p-8 lg:col-span-3">
      <FieldGroup><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground"> {t("Inputs saved on this device.")} </p><Button variant="outline" size="sm" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
        <SelectField label={t("Account & currency preset")} value={currency} onChange={changePreset} options={Object.entries(stripePresets).map(([value, preset]) => ({ value, label: t(preset.label) }))} />
        <ToggleGroup type="single" value={mode} onValueChange={changeMode} variant="outline" className="w-full" aria-label={t("Calculation direction")}><ToggleGroupItem value="charge" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I charge")} </ToggleGroupItem><ToggleGroupItem value="receive" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I want to receive")} </ToggleGroupItem></ToggleGroup>
        <NumberField label={mode === 'charge' ? t("Payment amount") : t("Desired remaining amount")} value={amount} onChange={setAmount} suffix={currency} />
        <Separator />
        <div className="flex items-center justify-between"><h2 className="font-medium"> {t("Make the numbers yours")} </h2><Button variant="ghost" size="sm" onClick={() => { setDraft(defaults(currency, plan)); setInternational(false); setConversion(false); }}><RotateCcw data-icon="inline-start" /> {t("Reset rates")} </Button></div>
        <div className="grid gap-5 sm:grid-cols-2"><NumberField label={t("Processing rate")} suffix="%" value={draft.percent} max={100} onChange={value => update('percent', value)} /><NumberField label={t("Fixed processing fee")} suffix={currency} value={draft.fixed} max={1e6} onChange={value => update('fixed', value)} /></div>
        <div className="grid gap-5 sm:grid-cols-2"><SelectField label={t("Radar plan preset")} value={plan} onChange={value => { setPlan(value as RadarPlan); update('radar', String(stripePresets[currency].radar[value as RadarPlan])); }} options={['lite', 'standard', 'plus', 'pro'].map(value => ({ value, label: `Radar ${value[0].toUpperCase()}${value.slice(1)}` }))} /><NumberField label={t("Radar per screened payment")} value={draft.radar} onChange={value => update('radar', value)} suffix={currency} max={1e6} /></div>
        <div className="grid gap-5 sm:grid-cols-2"><NumberField label={t("Tax on fees (IVA)")} value={draft.tax} onChange={value => update('tax', value)} max={100} suffix="%" /><NumberField label={t("Other per-payment costs")} value={draft.extra} onChange={value => update('extra', value)} suffix={currency} max={1e6} hint={plan === 'pro' ? t('Pro abuse events cost {cost} {currency} each. Add your expected event costs here.', { cost: stripePresets[currency].abuse, currency }) : t("Optional additional costs, before fee tax.")} /></div>
        <Field orientation="horizontal"><Switch id="international" checked={international} onCheckedChange={setInternational} /><FieldLabel htmlFor="international"> {t("International card")} </FieldLabel></Field>
        {international && <NumberField label={t("International card surcharge")} value={draft.international} max={100} onChange={value => update('international', value)} suffix="%" />}
        <Field orientation="horizontal"><Switch id="conversion" checked={conversion} onCheckedChange={setConversion} /><FieldLabel htmlFor="conversion"> {t("Currency conversion required")} </FieldLabel></Field>
        {conversion && <NumberField label={t("Currency conversion surcharge")} value={draft.conversion} max={100} onChange={value => update('conversion', value)} suffix="%" />}
      </FieldGroup>
    </div>
    <div className="flex flex-col gap-5 lg:col-span-2 lg:sticky lg:top-8">
      <section className="result-panel" aria-label={t("Stripe fee result")} aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium">{mode === 'charge' ? t("You receive") : t("You need to charge")}</h2><ArrowDownUp size={20} strokeWidth={1.5} /></div>
        {result ? <><p className="result-value">{money(mode === 'charge' ? result.net : result.gross, currency, locale)}</p><span className="-mt-3 text-xs text-muted-foreground">{currency} {t("· per successful payment")} </span><Separator /><dl><ResultRow label={t("Customer pays")} value={money(result.gross, currency, locale)} /><ResultRow label={t("Processing fees")} value={money(result.processing, currency, locale)} /><ResultRow label="Radar" value={money(result.radar, currency, locale)} />{result.extra > 0 && <ResultRow label={t("Other costs")} value={money(result.extra, currency, locale)} />}<ResultRow label={t('Fee tax ({tax}%)', { tax: draft.tax })} value={money(result.tax, currency, locale)} /><ResultRow label={t("Total fees & tax")} value={money(result.fee, currency, locale)} /><ResultRow label={t("You keep")} value={money(result.net, currency, locale)} /></dl>{result.net < 0 && <p className="text-sm text-destructive"> {t("The fees exceed this payment. Increase the charge or adjust the rates.")} </p>}<Button variant="outline" onClick={() => changeMode(mode === 'charge' ? 'receive' : 'charge')}><ArrowDownUp data-icon="inline-start" />{mode === 'charge' ? t("Set what I want to receive") : t("Set what I charge")}</Button></> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </section>
      <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"><ShieldCheck size={16} className="mt-1 shrink-0" /> {t("Your numbers stay on this device. Nothing is sent to Stripe.")} </p>
      <p className="text-xs leading-6 text-muted-foreground"> {t("Presets use domestic online card pricing for the selected account country. All fields are editable. Selecting a new preset replaces your rate edits.")} </p>
    </div>
  </div>;
}

export default function StripeCalculator({ locale = 'en', ...props }: {} & { locale?: Locale }) {
  return <LocaleProvider locale={locale}><StripeCalculatorContent {...props} /></LocaleProvider>;
}
