import { useRef } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useSavingsStore, useHydrateCalculator } from '../../stores/calculators';
import { Download, RotateCcw, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@portfolio/ui/components/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@portfolio/ui/components/chart';
import { savingsGrowth, roundMoney, type Compounding } from '@portfolio/calculators';
import { NumberField, SelectField, AmountField, Settings, Receipt, MobileResult, Insights, money } from './Fields';
function SavingsCalculatorContent() {
  const { t, locale } = useTranslation();
  useHydrateCalculator(useSavingsStore);
  const { values, set, reset } = useSavingsStore();
  const { currency, initial, monthly, rate, years, compounding, showTable } = values;
  let rows: ReturnType<typeof savingsGrowth> = [], error = '';
  try {
    if ([initial, monthly, rate, years].some(value => value === '')) throw new Error(t("Fill in the empty fields to calculate."));
    rows = savingsGrowth({ initial: Number(initial), monthly: Number(monthly), annualRate: Number(rate), years: Number(years), compounding: Number(compounding) as Compounding });
  } catch (err) { error = (err as Error).message; rows = []; }
  const start = roundMoney(Number(initial));
  let deposited = start, earned = 0;
  // One row per year; cumulative totals feed the chart, yearly totals feed the table.
  const yearly = Array.from({ length: rows.length / 12 }, (_, index) => {
    const slice = rows.slice(index * 12, index * 12 + 12);
    const contribution = roundMoney(slice.reduce((sum, row) => sum + row.contribution, 0));
    const interest = roundMoney(slice.reduce((sum, row) => sum + row.interest, 0));
    deposited = roundMoney(deposited + contribution); earned = roundMoney(earned + interest);
    return { year: index + 1, contribution, interest, balance: slice.at(-1)!.balance, deposited, earned };
  });
  const final = yearly.at(-1);
  // Same colors as the receipt bar above: contributions in teal, interest in violet.
  const chartConfig = { deposited: { label: t("Contributions"), color: 'var(--glow-2)' }, earned: { label: t("Interest earned"), color: 'var(--glow-1)' } };
  function exportCSV() {
    const csv = [[t('Month'), ...[t("Contribution"), t("Interest"), t("Balance")].map(label => `${label} (${currency})`)].join(','), ...rows.map(row => [row.month, ...[row.contribution, row.interest, row.balance].map(value => value.toFixed(2))].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `savings-${currency}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const inputs = useRef<HTMLElement>(null), headlineRef = useRef<HTMLDivElement>(null);
  const headline = t('Your balance after {years} years', { years });
  const shown = final ? money(final.balance, currency, locale) : '—';
  const frequency = { '365': t("Daily"), '12': t("Monthly"), '1': t("Annually") }[compounding];
  const n = Number(compounding), r = Number(rate) / 100;
  const amount = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const share = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const lastYear = yearly.at(-1);
  const insights = final && lastYear ? [
    { label: t("Total contributions"), value: money(final.deposited, currency, locale) },
    { label: t("Interest share of the balance"), value: share(final.balance > 0 ? final.earned / final.balance : 0) },
    { label: t('Interest earned in year {year}', { year: lastYear.year }), value: money(lastYear.interest, currency, locale) },
  ] : [];
  return <div className="tool-workspace">
    <aside ref={inputs} className="tool-pane-inputs" aria-label={t("Inputs")}>
      <SelectField label={t("Currency")} value={currency} onChange={value => set('currency', value)} options={[{ value: 'MXN', label: t("Mexican peso · MXN") }, { value: 'USD', label: t("US dollar · USD") }]} />
      <AmountField label={t("Monthly contribution")} value={monthly} onChange={value => set('monthly', value)} currency={currency} quick={currency === 'USD' ? [100, 250, 500] : [1000, 2000, 5000]} hint={t("Added at the end of each month.")} />
      <FieldGroup>
        <NumberField label={t("Initial deposit")} suffix={currency} value={initial} onChange={value => set('initial', value)} />
        <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-1"><NumberField label={t("Annual interest rate")} value={rate} onChange={value => set('rate', value)} max={100} suffix="%" /><NumberField label={t("Years")} value={years} onChange={value => set('years', value)} min={1} max={60} step={1} /></div>
        <p className="text-sm text-muted-foreground"> {t("Illustrative default, not a market rate. Enter the nominal annual rate before taxes and inflation.")} </p>
      </FieldGroup>
      <Settings title={t("Compounding frequency")} summary={frequency}>
        <Field><FieldLabel className="sr-only"> {t("Compounding frequency")} </FieldLabel><ToggleGroup type="single" value={compounding} onValueChange={value => { if (value) set('compounding', value as typeof compounding); }} variant="outline" className="w-full" aria-label={t("Compounding frequency")}>{([['365', t("Daily")], ['12', t("Monthly")], ['1', t("Annually")]] as const).map(([value, label]) => <ToggleGroupItem key={value} value={value} className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center">{label}</ToggleGroupItem>)}</ToggleGroup><FieldDescription> {t("How often your institution adds interest to the balance.")} </FieldDescription></Field>
      </Settings>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Inputs saved on this device.")} </p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("Savings result")}>
      <div className="flex flex-col gap-8">
        {final ? <>
          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
            <div className="flex flex-col gap-6">
              <div ref={headlineRef} className="scroll-mt-28" aria-live="polite" aria-atomic="true"><h2 className="meta">{headline}</h2><p className="result-value mt-1">{shown}</p><p className="text-xs text-muted-foreground">{currency} · {t("before taxes and inflation")}</p></div>
              <Receipt segments={[{ label: t("Initial deposit"), value: start, color: 'var(--glow-3)' }, { label: t("Monthly contributions"), value: roundMoney(final.deposited - start), color: 'var(--glow-2)' }, { label: t("Interest earned"), value: final.earned, color: 'var(--glow-1)' }]} />
              <p className="text-xs leading-5 text-muted-foreground"> {t("Estimates assume a constant rate, no withdrawals, fees, or taxes on interest. Changing currency changes the label, not the exchange value.")} </p>
            </div>
            <div className="result-panel gap-4"><h3 className="meta">{t("Breakdown")}</h3><Receipt
              lines={[{ label: t("Initial deposit"), value: money(start, currency, locale) }, { sign: '+', label: t("Monthly contributions"), value: money(roundMoney(final.deposited - start), currency, locale) }, { sign: '+', label: t("Interest earned"), value: money(final.earned, currency, locale) }, { sign: '=', label: t("Final balance"), value: money(final.balance, currency, locale) }]}
              formula={[`i = (1 + ${Number(rate)}% ÷ ${n})^(${n} ÷ 12) − 1 = ${new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 4 }).format(Math.expm1(n / 12 * Math.log1p(r / n)))}`]} /></div>
          </div>
          <Insights items={insights} />
          <section aria-labelledby="growth-heading"><h2 id="growth-heading" className="font-medium"> {t("Growth over time")} </h2><p className="mt-1 mb-5 text-sm text-muted-foreground"> {t("What you put in versus what interest adds, at the end of each year.")} </p>
            <ChartContainer config={chartConfig} className="h-72 w-full" role="img" aria-label={t("Stacked bar chart of contributions and interest by year. The yearly breakdown table has the same values.")}><BarChart data={yearly} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="year" tickLine={false} axisLine={false} /><YAxis width={72} tickLine={false} axisLine={false} tickFormatter={value => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { notation: 'compact' }).format(value)} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => t('Year {year}', { year: payload[0]?.payload.year })} formatter={(value, name) => <div className="flex flex-1 justify-between gap-4"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig].label}</span><span className="font-medium tabular-nums">{money(Number(value), currency, locale)}</span></div>} />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="deposited" stackId="total" fill="var(--color-deposited)" isAnimationActive={false} /><Bar dataKey="earned" stackId="total" fill="var(--color-earned)" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ChartContainer>
          </section>
          <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => set('showTable', !showTable)} aria-expanded={showTable} aria-controls="yearly">{showTable ? t("Hide") : t("View")} {t("yearly breakdown")} </Button><Button variant="outline" onClick={exportCSV}><Download data-icon="inline-start" /> {t("Download monthly breakdown")} </Button></div>
          {showTable && <div id="yearly" className="flex flex-col gap-2"><p className="meta">{t('Amounts in {currency}', { currency })}</p><div className="rounded-xl border"><Table className="text-xs tabular-nums [&_td]:px-2 [&_td]:py-1.5 [&_th]:h-auto [&_th]:px-2 [&_th]:py-2 [&_th]:align-bottom [&_th]:whitespace-normal"><TableHeader><TableRow><TableHead> {t("Year")} </TableHead><TableHead> {t("Contributions")} </TableHead><TableHead> {t("Interest")} </TableHead><TableHead> {t("Total contributions")} </TableHead><TableHead> {t("Interest earned")} </TableHead><TableHead> {t("Balance")} </TableHead></TableRow></TableHeader><TableBody>{yearly.map(row => <TableRow key={row.year}><TableCell>{row.year}</TableCell><TableCell>{amount(row.contribution)}</TableCell><TableCell>{amount(row.interest)}</TableCell><TableCell>{amount(row.deposited)}</TableCell><TableCell>{amount(row.earned)}</TableCell><TableCell>{amount(row.balance)}</TableCell></TableRow>)}</TableBody></Table></div></div>}
        </> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
      </div>
    </section>
    <MobileResult label={headline} value={shown} inputs={inputs} result={headlineRef} />
  </div>;
}

export default function SavingsCalculator({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><SavingsCalculatorContent /></LocaleProvider>;
}
