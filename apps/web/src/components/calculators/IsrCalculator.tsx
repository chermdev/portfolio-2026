import { useRef } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useIsrStore, useHydrateCalculator, isrDefaults } from '../../stores/calculators';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup } from '@portfolio/ui/components/field';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { Iceberg } from '@portfolio/ui/components/iceberg';
import { salaryIsr, payrollContributions, socialSecurity2026, roundMoney } from '@portfolio/calculators';
import { NumberField, AmountField, Settings, Receipt, MobileResult, Insights, money } from './Fields';
function IsrCalculatorContent() {
  const { t, locale } = useTranslation();
  useHydrateCalculator(useIsrStore);
  const { values, set, reset } = useIsrStore();
  const { salary, subsidy, cap, uma, minimumWage, integration, riskPremium } = values;
  let result: (ReturnType<typeof salaryIsr> & { social: ReturnType<typeof payrollContributions>; takeHome: number }) | undefined, error = '';
  try {
    if (Object.values(values).some(value => value === '')) throw new Error(t("Fill in the empty fields to calculate."));
    const isr = salaryIsr(Number(salary), { amount: Number(subsidy), cap: Number(cap) });
    const social = payrollContributions(Number(salary), { ...socialSecurity2026, uma: Number(uma), minimumWage: Number(minimumWage), integration: Number(integration), riskPremium: Number(riskPremium) });
    result = { ...isr, social, takeHome: roundMoney(isr.income - isr.withheld - social.employee) };
  } catch (err) { error = (err as Error).message; }
  const mxn = (value: number) => money(value, 'MXN', locale);
  const percent = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const defaults = isrDefaults();
  const inputs = useRef<HTMLElement>(null), headlineRef = useRef<HTMLDivElement>(null);
  const headline = t("Your take-home pay per month");
  const shown = result ? mxn(result.takeHome) : '—';
  const youPay = result ? roundMoney(result.withheld + result.social.employee) : 0;
  const totalCost = result ? roundMoney(result.income + result.social.employer.total) : 0;
  const imssEdited = uma !== defaults.uma || minimumWage !== defaults.minimumWage || integration !== defaults.integration || riskPremium !== defaults.riskPremium;
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      <AmountField label={t("Monthly taxable salary")} value={salary} onChange={value => set('salary', value)} currency="MXN" quick={[10000, 20000, 40000]} hint={t("Gross monthly pay before deductions. Leave out exempt items such as part of your bonus or savings fund.")} />
      <Settings title={t("Employment subsidy")} summary={t('{amount} up to {cap} a month', { amount: mxn(Number(subsidy)), cap: mxn(Number(cap)) })} edited={subsidy !== defaults.subsidy || cap !== defaults.cap}>
        <FieldGroup>
          <NumberField label={t("Subsidy amount")} suffix="MXN" value={subsidy} onChange={value => set('subsidy', value)} max={1e6} hint={t("2026 decree: 15.02% of the monthly UMA, February to December. January used MXN 536.21.")} />
          <NumberField label={t("Applies up to a monthly income of")} suffix="MXN" value={cap} onChange={value => set('cap', value)} />
        </FieldGroup>
      </Settings>
      <Settings title={t("Social security (IMSS)")} summary={t('Risk premium {risk}% · integration factor {factor}', { risk: riskPremium, factor: integration })} edited={imssEdited}>
        <FieldGroup>
          <NumberField label={t("Work risk premium")} suffix="%" value={riskPremium} onChange={value => set('riskPremium', value)} max={15} hint={t("Set by each employer's risk class; 0.54355% is the premium assigned to new class I employers (office work).")} />
          <NumberField label={t("Integration factor")} value={integration} onChange={value => set('integration', value)} min={1} max={2} hint={t("Turns your daily pay into the contribution base (SBC). 1.0493 is the legal minimum for a first year: 15 days of bonus and 12 vacation days with a 25% premium.")} />
          <NumberField label={t("UMA per day")} suffix="MXN" value={uma} onChange={value => set('uma', value)} min={1} max={1e4} hint={t("INEGI, in effect from February 1, 2026.")} />
          <NumberField label={t("Minimum wage per day")} suffix="MXN" value={minimumWage} onChange={value => set('minimumWage', value)} min={1} max={1e4} hint={t("General zone, DOF December 9, 2025. The northern border zone uses MXN 440.87.")} />
        </FieldGroup>
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Inputs saved on this device.")} </p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("ISR result")}>
      <div className="flex flex-col gap-8">
        {result ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <div ref={headlineRef} className="scroll-mt-28" aria-live="polite" aria-atomic="true"><h2 className="meta">{headline}</h2><p className="result-value mt-1">{shown}</p><p className="text-xs text-muted-foreground">MXN · {t("after ISR and IMSS")}</p></div>
              <Receipt segments={[{ label: t("Take-home pay"), value: result.takeHome, color: 'var(--glow-2)' }, { label: t("ISR"), value: result.withheld, color: 'var(--glow-1)' }, { label: t("IMSS"), value: result.social.employee, color: 'color-mix(in oklab, var(--glow-1) 55%, var(--card))' }]} />
              <p className="text-xs leading-5 text-muted-foreground"> {t("Estimate of a monthly payroll: ISR withholding and your IMSS contributions. Infonavit credit payments and other deductions are not included, and the annual return can adjust ISR.")} </p>
              {result.subsidy > 0 && <p className="text-xs leading-5 text-muted-foreground"> {t("Earning more than {cap} a month removes the whole employment subsidy, so the withholding jumps there.", { cap: mxn(Number(cap)) })} </p>}
              {result.social.paysEmployeeShare && <p className="text-xs leading-5 text-muted-foreground"> {t("At the minimum wage your employer pays your IMSS share too, so none is deducted.")} </p>}
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt
              lines={[{ label: t("Monthly salary"), value: mxn(result.income) }, { sign: '−', label: t("ISR withheld"), value: mxn(result.withheld) }, { sign: '−', label: t("IMSS (your share)"), value: mxn(result.social.employee) }, { sign: '=', label: t("Take-home pay"), value: mxn(result.takeHome) }]}
              formula={result.rate ? [t("ISR = fixed fee + (income − lower limit) × rate"), `${mxn(result.fixed)} + (${mxn(result.income)} − ${mxn(result.lower)}) × ${result.rate}% = ${mxn(result.tax)}`, ...(result.subsidy > 0 ? [`${mxn(result.tax)} − ${mxn(result.subsidy)} ${t("subsidy")} = ${mxn(result.withheld)}`] : [])] : []} /></div>
          </div>
          <div className="result-panel gap-5">
            <div><h3 className="meta">{t("What your job really costs")}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Your payslip shows the tip. Below the water are your taxes and the contributions your employer pays on top of your salary: {cost} in total each month.", { cost: mxn(totalCost) })}</p></div>
            <Iceberg label={t("Iceberg: {net} take-home above the water; {you} paid by you and {employer} paid by your employer below it.", { net: mxn(result.takeHome), you: mxn(youPay), employer: mxn(result.social.employer.total) })} groups={[
              { title: t("What you take home"), parts: [{ label: t("Take-home pay"), amount: result.takeHome, value: mxn(result.takeHome), color: 'var(--glow-2)' }] },
              { title: t("What you pay"), parts: [{ label: t("ISR"), amount: result.withheld, value: mxn(result.withheld), color: 'var(--glow-1)' }, { label: t("IMSS (your share)"), amount: result.social.employee, value: mxn(result.social.employee), color: 'color-mix(in oklab, var(--glow-1) 55%, var(--card))' }] },
              { title: t("What your employer pays"), parts: [{ label: t("IMSS"), amount: result.social.employer.imss, value: mxn(result.social.employer.imss), color: 'var(--glow-3)' }, { label: t("Retirement (SAR)"), amount: result.social.employer.retirement, value: mxn(result.social.employer.retirement), color: 'color-mix(in oklab, var(--glow-3) 70%, var(--card))' }, { label: t("Infonavit"), amount: result.social.employer.infonavit, value: mxn(result.social.employer.infonavit), color: 'color-mix(in oklab, var(--glow-3) 45%, var(--card))' }] },
            ]} />
          </div>
          <Insights items={[
            { label: t("ISR withheld"), value: mxn(result.withheld) },
            { label: t("Effective rate on your pay"), value: percent(result.income > 0 ? youPay / result.income : 0) },
            { label: t("Real rate, counting your employer's part"), value: percent(totalCost > 0 ? (youPay + result.social.employer.total) / totalCost : 0) },
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
