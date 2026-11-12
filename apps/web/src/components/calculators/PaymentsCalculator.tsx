import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useRef } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup } from '@portfolio/ui/components/field';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { mxPaymentPresets, mercadoPagoMsi, mxFeeConfig, stripeFees, grossForNet, type MxPaymentPlan } from '@portfolio/calculators';
import { NumberField, SelectField, AmountField, Settings, Receipt, MobileResult, Insights, Headline, money } from './Fields';
import { type brands } from '../brands';
import { useMercadoPagoStore, useClipStore, useHydrateCalculator, paymentDraft, type PaymentDraft } from '../../stores/calculators';
const plans = Object.keys(mxPaymentPresets) as MxPaymentPlan[];
type Brand = keyof typeof brands;
const terms = Object.keys(mercadoPagoMsi) as `${keyof typeof mercadoPagoMsi}`[];
// One calculator per provider; each keeps its own saved inputs. The comparison still prices the sale on every plan.
function PaymentsCalculatorContent({ brand }: { brand: Brand }) {
  const { t, locale } = useTranslation();
  const store = brand === 'clip' ? useClipStore : useMercadoPagoStore;
  useHydrateCalculator(store);
  const { values: { provider, term, draft, mode, amount }, set, reset } = store();
  const preset = mxPaymentPresets[provider];
  const currency = 'MXN';
  const update = (key: keyof PaymentDraft, value: string) => set('draft', (prev: PaymentDraft) => ({ ...prev, [key]: value }));
  const num = (value: string) => value === '' ? NaN : Number(value);
  const config = mxFeeConfig(num(draft.percent), num(draft.fixed), num(draft.msi), num(draft.tax));
  let result: ReturnType<typeof stripeFees> | undefined, error = '';
  try {
    if (amount === '') throw new Error(t("Enter an amount to calculate."));
    const gross = mode === 'charge' ? Number(amount) : grossForNet(Number(amount), config);
    result = stripeFees(gross, config);
  } catch (err) { error = (err as Error).message; }
  // A new plan or term loads its published rates; the term keeps applying when the new plan has an MSI table.
  const changeProvider = (value: string) => {
    const next = value as MxPaymentPlan, keep = mxPaymentPresets[next].msi ? term : '0';
    set('provider', next); set('term', keep);
    set('draft', { ...paymentDraft(next), msi: String(mercadoPagoMsi[Number(keep) as keyof typeof mercadoPagoMsi]) });
  };
  const changeTerm = (value: string) => { set('term', value); update('msi', String(mercadoPagoMsi[Number(value) as keyof typeof mercadoPagoMsi])); };
  const brandPlans = plans.filter(plan => mxPaymentPresets[plan].brand === brand);
  function changeMode(value: string) { if (!value) return; if (result) set('amount', String(value === 'charge' ? result.gross : Math.max(0, result.net))); set('mode', value); }
  const inputs = useRef<HTMLElement>(null), receipt = useRef<HTMLDivElement>(null);
  const number = (value: number, digits = 2) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits || 6 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
  const defaults = { ...paymentDraft(provider), msi: String(mercadoPagoMsi[Number(term) as keyof typeof mercadoPagoMsi]) };
  const edited = JSON.stringify(draft) !== JSON.stringify(defaults);
  const headline = mode === 'charge' ? t("You receive") : t("You need to charge");
  const shown = result ? money(mode === 'charge' ? result.net : result.gross, currency, locale) : '—';
  const insights: { label: string; value: string }[] = [];
  // The same sale on every other plan at its published rates. Clip publishes no MSI table, so it drops out when a term is chosen;
  // a hand-typed MSI rate has no published equivalent on the other plans, so the comparison is left out.
  const compare: { label: string; value: string }[] = [];
  const msi = mercadoPagoMsi[Number(term) as keyof typeof mercadoPagoMsi], comparable = num(draft.msi) === msi;
  if (result && result.gross > 0) {
    insights.push({ label: t("Effective fee"), value: percent(result.fee / result.gross) });
    try {
      insights.push(mode === 'charge'
        ? { label: t('To receive {amount}, charge', { amount: money(Number(amount), currency, locale) }), value: money(grossForNet(Number(amount), config), currency, locale) }
        : { label: t('If you charge {amount}, you receive', { amount: money(Number(amount), currency, locale) }), value: money(stripeFees(Number(amount), config).net, currency, locale) });
    } catch { /* The opposite direction can be out of range; skip it. */ }
    const tax = Number.isFinite(config.tax) ? config.tax : 16;
    for (const plan of comparable ? plans : []) {
      if (plan === provider || (msi > 0 && !mxPaymentPresets[plan].msi)) continue;
      const other = mxFeeConfig(mxPaymentPresets[plan].percent, mxPaymentPresets[plan].fixed, msi, tax);
      try {
        compare.push(mode === 'charge'
          ? { label: t('{plan}: you receive', { plan: t(mxPaymentPresets[plan].label) }), value: money(stripeFees(result.gross, other).net, currency, locale) }
          : { label: t('{plan}: charge', { plan: t(mxPaymentPresets[plan].label) }), value: money(grossForNet(Number(amount), other), currency, locale) });
      } catch { /* Skip a plan the amount cannot be computed for. */ }
    }
  }
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      {brandPlans.length > 1 && <SelectField label={t("Plan")} value={provider} onChange={changeProvider} options={brandPlans.map(value => ({ value, label: t(mxPaymentPresets[value].label).split(' · ')[1] }))} />}
      <ToggleGroup type="single" value={mode} onValueChange={changeMode} variant="outline" className="w-full" aria-label={t("Calculation direction")}><ToggleGroupItem value="charge" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I charge")} </ToggleGroupItem><ToggleGroupItem value="receive" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("I want to receive")} </ToggleGroupItem></ToggleGroup>
      <AmountField label={mode === 'charge' ? t("Payment amount") : t("Desired remaining amount")} value={amount} onChange={value => set('amount', value)} currency={currency} quick={[500, 1000, 5000]} />
      {preset.msi && <SelectField label={t("Months without interest (MSI)")} value={term} onChange={changeTerm} options={terms.map(value => ({ value, label: value === '0' ? t("Single payment") : t('{n} months · +{rate}%', { n: value, rate: mercadoPagoMsi[Number(value) as keyof typeof mercadoPagoMsi] }) }))} />}
      <Settings title={t("Rates")} edited={edited} summary={t('{percent}% + {fixed} · IVA {tax}%', { percent: draft.percent, fixed: money(Number(draft.fixed), currency, locale), tax: draft.tax }) + (Number(draft.msi) > 0 ? ` · MSI +${draft.msi}%` : '')}>
        <FieldGroup>
          <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-1"><NumberField label={t("Processing rate")} suffix="%" value={draft.percent} max={100} onChange={value => update('percent', value)} /><NumberField label={t("Fixed fee per sale")} suffix={currency} value={draft.fixed} max={1e6} onChange={value => update('fixed', value)} /></div>
          <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-1"><NumberField label={t("MSI surcharge")} suffix="%" value={draft.msi} max={100} onChange={value => update('msi', value)} hint={preset.msi ? undefined : t("Clip does not publish its MSI rates. Enter yours if you offer months without interest.")} /><NumberField label={t("Tax on fees (IVA)")} value={draft.tax} onChange={value => update('tax', value)} max={100} suffix="%" /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground"> {t("Selecting a new plan replaces your rate edits.")} </p><Button variant="ghost" size="sm" onClick={() => set('draft', defaults)}><RotateCcw data-icon="inline-start" /> {t("Reset rates")} </Button></div>
        </FieldGroup>
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Your numbers stay on this device. Nothing is sent to {provider}.", { provider: brand === 'clip' ? 'Clip' : 'Mercado Pago' })} </p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("Fee result")}>
      <div className="flex flex-col gap-8">
        {result ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <Headline ref={receipt} label={headline} value={shown} note={`${currency} · ${t(preset.label)}`} />
              <Receipt segments={[{ label: t("You keep"), value: result.net, color: 'var(--glow-2)' }, { label: t("Processing fees"), value: result.processing, color: 'var(--glow-1)' }, { label: t("Fee tax"), value: result.tax, color: 'var(--muted-foreground)' }]} />
              {result.net < 0 && <p className="text-sm text-destructive"> {t("The fees exceed this payment. Increase the charge or adjust the rates.")} </p>}
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt lines={[{ label: t("Customer pays"), value: money(result.gross, currency, locale) }, { sign: '−', label: t("Processing fees"), value: money(result.processing, currency, locale) }, { sign: '−', label: t('Fee tax ({tax}%)', { tax: draft.tax }), value: money(result.tax, currency, locale) }, { sign: '=', label: t("You keep"), value: money(result.net, currency, locale) }]}
              formula={[`${t("Processing fees")}: ${number(result.gross)} × ${number(config.percent, 0)}% + ${number(config.fixed)} = ${number(result.processing)}`, `${t("Fee tax")}: ${number(result.processing)} × ${number(config.tax, 0)}% = ${number(result.tax)}`]} /></div>
          </div>
          {insights.length > 0 && <Insights items={insights} />}
          {compare.length > 0 && <div className="flex flex-col gap-3"><h3 className="meta">{t("The same sale on other plans, at published rates")}</h3><Insights items={compare} /></div>}
        </> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </div>
    </section>
    <MobileResult label={headline} value={shown} inputs={inputs} result={receipt} />
  </div>;
}

export default function PaymentsCalculator({ locale = 'en', brand }: { locale?: Locale; brand: Brand }) {
  return <LocaleProvider locale={locale}><PaymentsCalculatorContent brand={brand} /></LocaleProvider>;
}
