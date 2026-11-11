import { useRef } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useIsrStore, useHydrateCalculator, isrDefaults } from '../../stores/calculators';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup } from '@portfolio/ui/components/field';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { salaryIsr } from '@portfolio/calculators';
import { NumberField, AmountField, Settings, Receipt, MobileResult, Insights, money } from './Fields';
function IsrCalculatorContent() {
  const { t, locale } = useTranslation();
  useHydrateCalculator(useIsrStore);
  const { values, set, reset } = useIsrStore();
  const { salary, subsidy, cap } = values;
  let result: ReturnType<typeof salaryIsr> | undefined, error = '';
  try {
    if ([salary, subsidy, cap].some(value => value === '')) throw new Error(t("Fill in the empty fields to calculate."));
    result = salaryIsr(Number(salary), { amount: Number(subsidy), cap: Number(cap) });
  } catch (err) { error = (err as Error).message; }
  const mxn = (value: number) => money(value, 'MXN', locale);
  const percent = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
  const defaults = isrDefaults();
  const inputs = useRef<HTMLElement>(null), headlineRef = useRef<HTMLDivElement>(null);
  const headline = t("ISR withheld per month");
  const shown = result ? mxn(result.withheld) : '—';
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      <AmountField label={t("Monthly taxable salary")} value={salary} onChange={value => set('salary', value)} currency="MXN" quick={[10000, 20000, 40000]} hint={t("Gross monthly pay before deductions. Leave out exempt items such as part of your bonus or savings fund.")} />
      <Settings title={t("Employment subsidy")} summary={t('{amount} up to {cap} a month', { amount: mxn(Number(subsidy)), cap: mxn(Number(cap)) })} edited={subsidy !== defaults.subsidy || cap !== defaults.cap}>
        <FieldGroup>
          <NumberField label={t("Subsidy amount")} suffix="MXN" value={subsidy} onChange={value => set('subsidy', value)} max={1e6} hint={t("2026 decree: 15.02% of the monthly UMA, February to December. January used MXN 536.21.")} />
          <NumberField label={t("Applies up to a monthly income of")} suffix="MXN" value={cap} onChange={value => set('cap', value)} />
        </FieldGroup>
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Inputs saved on this device.")} </p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("ISR result")}>
      <div className="flex flex-col gap-8">
        {result ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <div ref={headlineRef} className="scroll-mt-28" aria-live="polite" aria-atomic="true"><h2 className="meta">{headline}</h2><p className="result-value mt-1">{shown}</p><p className="text-xs text-muted-foreground">MXN · {t("2026 monthly tariff")}</p></div>
              <Receipt segments={[{ label: t("Take-home pay"), value: result.net, color: 'var(--glow-2)' }, { label: t("ISR"), value: result.withheld, color: 'var(--glow-1)' }]} />
              <p className="text-xs leading-5 text-muted-foreground"> {t("Estimate of the employer's monthly withholding. Social security (IMSS) and other deductions are not included; the annual return can adjust the final amount.")} </p>
              {result.subsidy > 0 && <p className="text-xs leading-5 text-muted-foreground"> {t("Earning more than {cap} a month removes the whole employment subsidy, so the withholding jumps there.", { cap: mxn(Number(cap)) })} </p>}
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt
              lines={[{ label: t("Tax from the tariff"), value: mxn(result.tax) }, { sign: '−', label: t("Employment subsidy"), value: mxn(result.subsidy) }, { sign: '=', label: t("ISR withheld"), value: mxn(result.withheld) }]}
              formula={result.rate ? [t("ISR = fixed fee + (income − lower limit) × rate"), `${mxn(result.fixed)} + (${mxn(result.income)} − ${mxn(result.lower)}) × ${result.rate}% = ${mxn(result.tax)}`] : []} /></div>
          </div>
          <Insights items={[
            { label: t("Take-home pay before IMSS"), value: mxn(result.net) },
            { label: t("Effective rate"), value: percent(result.income > 0 ? result.withheld / result.income : 0) },
            { label: t("Rate on your next peso"), value: `${result.rate}%` },
          ]} />
        </> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </div>
    </section>
    <MobileResult label={headline} value={shown} inputs={inputs} result={headlineRef} />
  </div>;
}

export default function IsrCalculator({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><IsrCalculatorContent /></LocaleProvider>;
}
