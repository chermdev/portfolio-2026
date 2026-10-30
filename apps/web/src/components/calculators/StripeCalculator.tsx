import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useRef } from 'react';
import { ArrowDownUp, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup, Field, FieldLabel } from '@portfolio/ui/components/field';
import { Switch } from '@portfolio/ui/components/switch';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { stripePresets, stripeFees, grossForNet, type Currency, type RadarPlan, type FeeConfig } from '@portfolio/calculators';
import { NumberField, SelectField, AmountField, Settings, Receipt, MobileResult, Insights, money } from './Fields';
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
  // `receipt` marks the headline amount: the mobile bar hides once that number is on screen.
  const inputs = useRef<HTMLElement>(null), receipt = useRef<HTMLDivElement>(null);
  const number = (value: number, digits = 2) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits || 6 }).format(value);
  const rate = config.percent + config.international + config.conversion;
  const edited = JSON.stringify(draft) !== JSON.stringify(defaults(currency, plan));
  const headline = mode === 'charge' ? t("You receive") : t("You need to charge");
  const shown = result ? money(mode === 'charge' ? result.net : result.gross, currency, locale) : '—';
  const percent = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
  // Extra answers from the same inputs: the effective rate, the opposite direction for this amount, and the other card type.
  const insights: { label: string; value: string }[] = [];
  if (result && result.gross > 0) {
    insights.push({ label: t("Effective fee"), value: percent(result.fee / result.gross) });
    try {
      insights.push(mode === 'charge'
        ? { label: t('To receive {amount}, charge', { amount: money(Number(amount), currency, locale) }), value: money(grossForNet(Number(amount), config), currency, locale) }
        : { label: t('If you charge {amount}, you receive', { amount: money(Number(amount), currency, locale) }), value: money(stripeFees(Number(amount), config).net, currency, locale) });
    } catch { /* The opposite direction can be out of range; skip it. */ }
    try {
      insights.push({ label: international ? t("With a domestic card, you receive") : t("With an international card, you receive"), value: money(stripeFees(result.gross, { ...config, international: international ? 0 : Number(draft.international) }).net, currency, locale) });
    } catch { /* An empty surcharge field makes this comparison invalid; skip it. */ }
  }
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      <SelectField label={t("Account & currency preset")} value={currency} onChange={changePreset} options={Object.entries(stripePresets).map(([value, preset]) => ({ value, label: t(preset.label) }))} />
      <ToggleGroup type="single" value={mode} onValueChange={changeMode} variant="outline" className="w-full" aria-label={t("Calculation direction")}><ToggleGroupItem value="charge" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I charge")} </ToggleGroupItem><ToggleGroupItem value="receive" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I want to receive")} </ToggleGroupItem></ToggleGroup>
      <AmountField label={mode === 'charge' ? t("Payment amount") : t("Desired remaining amount")} value={amount} onChange={setAmount} currency={currency} quick={currency === 'MXN' ? [500, 1000, 5000] : [50, 100, 500]} />
      <div className="flex flex-col gap-4"><Field orientation="horizontal"><Switch id="international" checked={international} onCheckedChange={setInternational} /><FieldLabel htmlFor="international"> {t("International card")} </FieldLabel></Field><Field orientation="horizontal"><Switch id="conversion" checked={conversion} onCheckedChange={setConversion} /><FieldLabel htmlFor="conversion"> {t("Currency conversion required")} </FieldLabel></Field></div>
      <Settings title={t("Rates and Radar")} edited={edited} summary={t('{percent}% + {fixed} · tax {tax}%', { percent: draft.percent, fixed: money(Number(draft.fixed), currency, locale), tax: draft.tax }) + (Number(draft.radar) > 0 ? ` · Radar ${money(Number(draft.radar), currency, locale)}` : '')}>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2"><NumberField label={t("Processing rate")} suffix="%" value={draft.percent} max={100} onChange={value => update('percent', value)} /><NumberField label={t("Fixed processing fee")} suffix={currency} value={draft.fixed} max={1e6} onChange={value => update('fixed', value)} /></div>
          <div className="grid gap-5 sm:grid-cols-2"><SelectField label={t("Radar plan preset")} value={plan} onChange={value => { setPlan(value as RadarPlan); update('radar', String(stripePresets[currency].radar[value as RadarPlan])); }} options={['lite', 'standard', 'plus', 'pro'].map(value => ({ value, label: `Radar ${value[0].toUpperCase()}${value.slice(1)}` }))} /><NumberField label={t("Radar per screened payment")} value={draft.radar} onChange={value => update('radar', value)} suffix={currency} max={1e6} /></div>
          <div className="grid gap-5 sm:grid-cols-2"><NumberField label={t("Tax on fees (IVA)")} value={draft.tax} onChange={value => update('tax', value)} max={100} suffix="%" /><NumberField label={t("Other per-payment costs")} value={draft.extra} onChange={value => update('extra', value)} suffix={currency} max={1e6} hint={plan === 'pro' ? t('Pro abuse events cost {cost} {currency} each. Add your expected event costs here.', { cost: stripePresets[currency].abuse, currency }) : t("Optional additional costs, before fee tax.")} /></div>
          {(international || conversion) && <div className="grid gap-5 sm:grid-cols-2">{international && <NumberField label={t("International card surcharge")} value={draft.international} max={100} onChange={value => update('international', value)} suffix="%" />}{conversion && <NumberField label={t("Currency conversion surcharge")} value={draft.conversion} max={100} onChange={value => update('conversion', value)} suffix="%" />}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground"> {t("Selecting a new preset replaces your rate edits.")} </p><Button variant="ghost" size="sm" onClick={() => { setDraft(defaults(currency, plan)); setInternational(false); setConversion(false); }}><RotateCcw data-icon="inline-start" /> {t("Reset rates")} </Button></div>
        </FieldGroup>
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Your numbers stay on this device. Nothing is sent to Stripe.")} </p><Button variant="ghost" size="sm" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("Stripe fee result")}>
      <div className="flex flex-col gap-8">
        {result ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <div ref={receipt} className="scroll-mt-28" aria-live="polite" aria-atomic="true"><h2 className="meta">{headline}</h2><p className="result-value mt-1">{shown}</p><p className="text-xs text-muted-foreground">{currency} {t("· per successful payment")}</p></div>
              <Receipt segments={[{ label: t("You keep"), value: result.net, color: 'var(--glow-2)' }, { label: t("Processing fees"), value: result.processing, color: 'var(--glow-1)' }, { label: 'Radar', value: result.radar, color: 'var(--glow-3)' }, { label: t("Other costs"), value: result.extra, color: 'var(--chart-4)' }, { label: t("Fee tax"), value: result.tax, color: 'var(--muted-foreground)' }]} />
              {result.net < 0 && <p className="text-sm text-destructive"> {t("The fees exceed this payment. Increase the charge or adjust the rates.")} </p>}
              <Button variant="outline" className="self-start" onClick={() => changeMode(mode === 'charge' ? 'receive' : 'charge')}><ArrowDownUp data-icon="inline-start" />{mode === 'charge' ? t("Set what I want to receive") : t("Set what I charge")}</Button>
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt lines={[{ label: t("Customer pays"), value: money(result.gross, currency, locale) }, { sign: '−', label: t("Processing fees"), value: money(result.processing, currency, locale) }, ...(result.radar > 0 ? [{ sign: '−' as const, label: 'Radar', value: money(result.radar, currency, locale) }] : []), ...(result.extra > 0 ? [{ sign: '−' as const, label: t("Other costs"), value: money(result.extra, currency, locale) }] : []), { sign: '−', label: t('Fee tax ({tax}%)', { tax: draft.tax }), value: money(result.tax, currency, locale) }, { sign: '=', label: t("You keep"), value: money(result.net, currency, locale) }]}
          formula={[`${t("Processing fees")}: ${number(result.gross)} × ${number(rate, 0)}% + ${number(config.fixed)} = ${number(result.processing)}`, `${t("Fee tax")}: ${number(result.processing + result.radar + result.extra)} × ${number(config.tax, 0)}% = ${number(result.tax)}`]} /></div>
          </div>
          {insights.length > 0 && <Insights items={insights} />}
        </> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </div>
    </section>
    <MobileResult label={headline} value={shown} inputs={inputs} result={receipt} />
  </div>;
}

export default function StripeCalculator({ locale = 'en', ...props }: {} & { locale?: Locale }) {
  return <LocaleProvider locale={locale}><StripeCalculatorContent {...props} /></LocaleProvider>;
}
