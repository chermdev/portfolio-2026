import { useRef } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useResicoStore, useHydrateCalculator, resicoDefaults } from '../../stores/calculators';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup } from '@portfolio/ui/components/field';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { resicoTax, resicoAnnualLimit, roundMoney } from '@portfolio/calculators';
import { NumberField, AmountField, Settings, Receipt, MobileResult, Insights, money } from './Fields';
function ResicoCalculatorContent() {
  const { t, locale } = useTranslation();
  useHydrateCalculator(useResicoStore);
  const { values, set, reset } = useResicoStore();
  const { income, companies, retention } = values;
  let result: ReturnType<typeof resicoTax> | undefined, error = '';
  try {
    if ([income, companies, retention].some(value => value === '')) throw new Error(t("Fill in the empty fields to calculate."));
    result = resicoTax(Number(income), Number(companies), Number(retention));
  } catch (err) { error = (err as Error).message; }
  const mxn = (value: number) => money(value, 'MXN', locale);
  const amount = roundMoney(Number(income)), yearly = roundMoney(amount * 12);
  const inputs = useRef<HTMLElement>(null), headlineRef = useRef<HTMLDivElement>(null);
  const headline = t("What you keep this month");
  const kept = result ? roundMoney(amount - result.tax) : 0;
  const shown = result ? mxn(kept) : '—';
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      <AmountField label={t("Income collected this month")} value={income} onChange={value => set('income', value)} currency="MXN" quick={[20000, 40000, 80000]} hint={t("Before VAT. RESICO taxes income when you actually receive it, with no deductions.")} />
      <FieldGroup>
        <NumberField label={t("Of that, paid by companies")} suffix="MXN" value={companies} onChange={value => set('companies', value)} max={Math.min(1e9, Math.max(0, Number(income) || 0))} hint={t("Companies (personas morales) withhold part of the ISR when they pay you.")} />
      </FieldGroup>
      <Settings title={t("Withholding rate")} summary={`${retention}%`} edited={retention !== resicoDefaults().retention}>
        <NumberField label={t("Withholding rate")} suffix="%" value={retention} onChange={value => set('retention', value)} max={100} hint={t("1.25% under Art. 113-J of the ISR law.")} />
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Inputs saved on this device.")} </p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("RESICO result")}>
      <div className="flex flex-col gap-8">
        {result ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <div ref={headlineRef} className="scroll-mt-28" aria-live="polite" aria-atomic="true"><h2 className="meta">{headline}</h2><p className="result-value mt-1">{shown}</p><p className="text-xs text-muted-foreground">MXN · {t("after ISR")}</p></div>
              <Receipt segments={[{ label: t("What you keep"), value: kept, color: 'var(--glow-2)' }, { label: t("Withheld by companies"), value: Math.min(result.withheld, result.tax), color: 'var(--glow-3)' }, { label: t("Paid by you"), value: result.payment, color: 'var(--glow-1)' }]} />
              {yearly > resicoAnnualLimit && <Alert><AlertTitle> {t("Above the RESICO limit at this pace")} </AlertTitle><AlertDescription> {t("Twelve months like this add up to {yearly}. RESICO only applies while yearly income stays at or below MXN 3.5 million.", { yearly: mxn(yearly) })} </AlertDescription></Alert>}
              <p className="text-xs leading-5 text-muted-foreground"> {t("Estimate for individuals with business or professional income. VAT, the annual return, and income from other regimes are not included.")} </p>
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt
              lines={[{ label: t("Income collected"), value: mxn(amount) }, { sign: '−', label: t('ISR at {rate}%', { rate: result.rate }), value: mxn(result.tax) }, { sign: '=', label: t("What you keep"), value: mxn(kept) }]}
              formula={[`${mxn(amount)} × ${result.rate}% = ${mxn(result.tax)}`]} />
              <h3 className="meta mt-2">{t("How the ISR is paid")}</h3><Receipt
              lines={[{ label: t("ISR for the month"), value: mxn(result.tax) }, { sign: '−', label: t("Withheld by companies"), value: mxn(result.withheld) }, { sign: '=', label: t("ISR to pay"), value: mxn(result.payment) }, ...(result.credit > 0 ? [{ label: t("Withholding above the tax"), value: mxn(result.credit) }] : [])]}
              formula={result.withheld > 0 ? [`${mxn(Number(companies))} × ${Number(retention)}% = ${mxn(result.withheld)}`] : []} /></div>
          </div>
          <Insights items={[
            { label: t("ISR to pay this month"), value: mxn(result.payment) },
            { label: t("Rate for this month"), value: `${result.rate}%` },
            { label: result.headroom === null ? t("Rate band") : t("Income left at this rate"), value: result.headroom === null ? t("Top band") : mxn(result.headroom) },
            { label: t("Yearly income at this pace"), value: mxn(yearly) },
          ]} />
        </> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </div>
    </section>
    <MobileResult label={headline} value={shown} inputs={inputs} result={headlineRef} />
  </div>;
}

export default function ResicoCalculator({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><ResicoCalculatorContent /></LocaleProvider>;
}
