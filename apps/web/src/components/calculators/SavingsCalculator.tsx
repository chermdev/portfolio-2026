import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useSavingsStore, useHydrateCalculator } from '../../stores/calculators';
import { Download, PiggyBank, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { Separator } from '@portfolio/ui/components/separator';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@portfolio/ui/components/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@portfolio/ui/components/chart';
import { savingsGrowth, roundMoney, type Compounding } from '@portfolio/calculators';
import { NumberField, SelectField, ResultRow, money } from './Fields';
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
  const chartConfig = { deposited: { label: t("Contributions"), color: 'var(--chart-1)' }, earned: { label: t("Interest earned"), color: 'var(--chart-2)' } };
  function exportCSV() {
    const csv = [[t('Month'), ...[t("Contribution"), t("Interest"), t("Balance")].map(label => `${label} (${currency})`)].join(','), ...rows.map(row => [row.month, ...[row.contribution, row.interest, row.balance].map(value => value.toFixed(2))].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `savings-${currency}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="flex flex-col gap-10"><div className="grid items-start gap-8 lg:grid-cols-5">
    <div className="rounded-2xl border bg-card p-6 sm:p-8 lg:col-span-3"><FieldGroup><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground"> {t("Inputs saved on this device.")} </p><Button variant="outline" size="sm" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
      <SelectField label={t("Currency")} value={currency} onChange={value => set('currency', value)} options={[{ value: 'MXN', label: t("Mexican peso · MXN") }, { value: 'USD', label: t("US dollar · USD") }]} />
      <NumberField label={t("Initial deposit")} suffix={currency} value={initial} onChange={value => set('initial', value)} />
      <NumberField label={t("Monthly contribution")} suffix={currency} value={monthly} onChange={value => set('monthly', value)} hint={t("Added at the end of each month.")} />
      <Separator />
      <NumberField label={t("Annual interest rate")} value={rate} onChange={value => set('rate', value)} max={100} suffix="%" hint={t("Illustrative default, not a market rate. Enter the nominal annual rate before taxes and inflation.")} />
      <Field><FieldLabel> {t("Compounding frequency")} </FieldLabel><ToggleGroup type="single" value={compounding} onValueChange={value => { if (value) set('compounding', value as typeof compounding); }} variant="outline" className="w-full" aria-label={t("Compounding frequency")}>{([['365', t("Daily")], ['12', t("Monthly")], ['1', t("Annually")]] as const).map(([value, label]) => <ToggleGroupItem key={value} value={value} className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center">{label}</ToggleGroupItem>)}</ToggleGroup><FieldDescription> {t("How often your institution adds interest to the balance.")} </FieldDescription></Field>
      <NumberField label={t("Years")} value={years} onChange={value => set('years', value)} min={1} max={60} step={1} />
    </FieldGroup></div>
    <div className="lg:col-span-2 lg:sticky lg:top-8"><section className="result-panel" aria-label={t("Savings result")} aria-live="polite" aria-atomic="true"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">{t('Your balance after {years} years', { years })}</h2><PiggyBank size={22} strokeWidth={1.5} /></div>
      {final ? <><p className="result-value">{money(final.balance, currency, locale)}</p><p className="-mt-3 text-xs text-muted-foreground">{currency} · {t("before taxes and inflation")}</p><Separator /><dl><ResultRow label={t("Initial deposit")} value={money(start, currency, locale)} /><ResultRow label={t("Monthly contributions")} value={money(roundMoney(final.deposited - start), currency, locale)} /><ResultRow label={t("Total contributions")} value={money(final.deposited, currency, locale)} /><ResultRow label={t("Interest earned")} value={money(final.earned, currency, locale)} /><ResultRow label={t("Final balance")} value={money(final.balance, currency, locale)} /></dl><Button variant="outline" onClick={exportCSV}><Download data-icon="inline-start" /> {t("Download monthly breakdown")} </Button></> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
    </section><p className="mt-5 text-xs leading-6 text-muted-foreground"> {t("Estimates assume a constant rate, no withdrawals, fees, or taxes on interest. Changing currency changes the label, not the exchange value.")} </p></div>
  </div>
  {final && <section className="rounded-2xl border bg-card p-6 sm:p-8" aria-labelledby="growth-heading"><h2 id="growth-heading" className="subheading"> {t("Growth over time")} </h2><p className="mt-2 mb-6 text-sm text-muted-foreground"> {t("What you put in versus what interest adds, at the end of each year.")} </p>
    <ChartContainer config={chartConfig} className="h-72 w-full" role="img" aria-label={t("Stacked bar chart of contributions and interest by year. The yearly breakdown table has the same values.")}><BarChart data={yearly} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="year" tickLine={false} axisLine={false} /><YAxis width={72} tickLine={false} axisLine={false} tickFormatter={value => new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { notation: 'compact' }).format(value)} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => t('Year {year}', { year: payload[0]?.payload.year })} formatter={(value, name) => <div className="flex flex-1 justify-between gap-4"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig].label}</span><span className="font-medium tabular-nums">{money(Number(value), currency, locale)}</span></div>} />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="deposited" stackId="total" fill="var(--color-deposited)" isAnimationActive={false} /><Bar dataKey="earned" stackId="total" fill="var(--color-earned)" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ChartContainer>
  </section>}
  {final && <div><Button variant="outline" onClick={() => set('showTable', !showTable)} aria-expanded={showTable} aria-controls="yearly">{showTable ? t("Hide") : t("View")} {t("yearly breakdown")} </Button>{showTable && <div id="yearly" className="mt-6 rounded-xl border"><Table><TableHeader><TableRow><TableHead> {t("Year")} </TableHead><TableHead> {t("Contributions")} </TableHead><TableHead> {t("Interest")} </TableHead><TableHead> {t("Total contributions")} </TableHead><TableHead> {t("Interest earned")} </TableHead><TableHead> {t("Balance")} </TableHead></TableRow></TableHeader><TableBody>{yearly.map(row => <TableRow key={row.year}><TableCell>{row.year}</TableCell><TableCell>{money(row.contribution, currency, locale)}</TableCell><TableCell>{money(row.interest, currency, locale)}</TableCell><TableCell>{money(row.deposited, currency, locale)}</TableCell><TableCell>{money(row.earned, currency, locale)}</TableCell><TableCell>{money(row.balance, currency, locale)}</TableCell></TableRow>)}</TableBody></Table></div>}</div>}
  </div>;
}

export default function SavingsCalculator({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><SavingsCalculatorContent /></LocaleProvider>;
}
