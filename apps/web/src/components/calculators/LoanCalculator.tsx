import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useAutoStore, useMortgageStore, useHydrateCalculator } from '../../stores/calculators';
import { Download, House, CarFront, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { Slider } from '@portfolio/ui/components/slider';
import { Separator } from '@portfolio/ui/components/separator';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@portfolio/ui/components/table';
import { loanScenario, amortization } from '@portfolio/calculators';
import { NumberField, SelectField, ResultRow, money } from './Fields';
function LoanCalculatorContent({ kind }: { kind: 'auto' | 'home' }) {
  const { t, locale } = useTranslation();
  const home = kind === 'home';
  const store = home ? useMortgageStore : useAutoStore;
  useHydrateCalculator(store);
  const { values, set, reset } = store();
  const { mode, price, budget, currency, down, downType, tradeIn, rate, months, showSchedule, deposits, strategy } = values;
  const setMode = (value: typeof values.mode | ((previous: typeof values.mode) => typeof values.mode)) => set('mode', value);
  const setPrice = (value: typeof values.price | ((previous: typeof values.price) => typeof values.price)) => set('price', value);
  const setBudget = (value: typeof values.budget | ((previous: typeof values.budget) => typeof values.budget)) => set('budget', value);
  const setCurrency = (value: typeof values.currency | ((previous: typeof values.currency) => typeof values.currency)) => set('currency', value);
  const setDown = (value: typeof values.down | ((previous: typeof values.down) => typeof values.down)) => set('down', value);
  const setDownType = (value: typeof values.downType | ((previous: typeof values.downType) => typeof values.downType)) => set('downType', value);
  const setTradeIn = (value: typeof values.tradeIn | ((previous: typeof values.tradeIn) => typeof values.tradeIn)) => set('tradeIn', value);
  const setRate = (value: typeof values.rate | ((previous: typeof values.rate) => typeof values.rate)) => set('rate', value);
  const setMonths = (value: typeof values.months | ((previous: typeof values.months) => typeof values.months)) => set('months', value);
  const setShowSchedule = (value: typeof values.showSchedule | ((previous: typeof values.showSchedule) => typeof values.showSchedule)) => set('showSchedule', value);
  const setDeposits = (value: typeof values.deposits | ((previous: typeof values.deposits) => typeof values.deposits)) => set('deposits', value);
  const setStrategy = (value: typeof values.strategy | ((previous: typeof values.strategy) => typeof values.strategy)) => set('strategy', value);
  const updateDeposit = (id: number, key: 'month' | 'amount', value: string) => setDeposits(current => current.map(deposit => deposit.id === id ? { ...deposit, [key]: value } : deposit));
  let baseline: ReturnType<typeof amortization> = [];
  let result: ReturnType<typeof loanScenario> | undefined, error = '';
  let rows: ReturnType<typeof amortization> = [];
  try {
    if ([mode === 'payment' ? price : budget, down, rate, months, tradeIn].some(value => value === '')) throw new Error(t("Fill in the empty fields to calculate."));
    if (home && (Number(down) < 10 || Number(down) > 95 || Number(down) % 5 !== 0)) throw new Error(t("Choose a down payment from 10% to 95% in increments of 5%."));
    result = loanScenario({ mode, amount: Number(mode === 'payment' ? price : budget), annualRate: Number(rate), months: Number(months), down: Number(down), downType, tradeIn: home ? 0 : Number(tradeIn) });
    if (deposits.some(deposit => deposit.month === '' || deposit.amount === '')) throw new Error(t("Fill in the month and amount for every principal deposit."));
    baseline = amortization(result.principal, Number(rate), Number(months));
    rows = amortization(result.principal, Number(rate), Number(months), { strategy, deposits: deposits.map(({ month, amount }) => ({ month: Number(month), amount: Number(amount) })) });
    result.interest = rows.reduce((sum, row) => sum + row.interest, 0);
    result.total = rows.reduce((sum, row) => sum + row.totalPayment, 0) + result.downCash + (home ? 0 : Number(tradeIn));
  } catch (err) { error = (err as Error).message; result = undefined; }
  function exportCSV() {
    const csv = [[t('Month'), ...[t("Scheduled payment"), t("Extra principal"), t("Total payment"), t("Principal"), t("Interest"), t("Balance")].map(label => `${t(label)} (${currency})`)].join(','), ...rows.map(row => [row.month, row.payment, row.extraPayment, row.totalPayment, row.principal, row.interest, row.balance].map(value => value.toFixed(2)).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${kind}-loan-${currency}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const deposited = rows.reduce((sum, row) => sum + row.extraPayment, 0);
  const interestSaved = Math.max(0, baseline.reduce((sum, row) => sum + row.interest, 0) - (result?.interest ?? 0));
  const firstDepositIndex = rows.findIndex(row => row.extraPayment > 0);
  const Icon = home ? House : CarFront;
  return <div className="flex flex-col gap-10"><div className="grid items-start gap-8 lg:grid-cols-5">
    <div className="rounded-2xl border bg-card p-6 sm:p-8 lg:col-span-3"><FieldGroup><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground"> {t("Inputs saved on this device.")} </p><Button variant="outline" size="sm" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset calculator")} </Button></div>
      <ToggleGroup type="single" value={mode} onValueChange={value => { if (value) setMode(value as 'payment' | 'power'); }} variant="outline" className="w-full" aria-label={t("Loan calculation mode")}><ToggleGroupItem value="payment" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("Monthly payment")} </ToggleGroupItem><ToggleGroupItem value="power" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("Purchasing power")} </ToggleGroupItem></ToggleGroup>
      <SelectField label={t("Currency")} value={currency} onChange={setCurrency} options={[{ value: 'MXN', label: t("Mexican peso · MXN") }, { value: 'USD', label: t("US dollar · USD") }]} />
      <NumberField label={mode === 'payment' ? home ? t("Home price") : t("Vehicle price") : t("Monthly payment budget")} suffix={currency} value={mode === 'payment' ? price : budget} onChange={mode === 'payment' ? setPrice : setBudget} />
      <Separator />
      {!home && <SelectField label={t("Down payment (enganche) format")} value={downType} onChange={value => { setDownType(value as 'percent' | 'cash'); setDown(value === 'percent' ? '20' : '90000'); }} options={[{ value: 'percent', label: t("Percentage of purchase price") }, { value: 'cash', label: t('Fixed amount in {currency}', { currency }) }]} />}
      <NumberField label={t("Down payment (enganche)")} value={down} onChange={setDown} suffix={downType === 'percent' ? '%' : currency} min={home ? 10 : 0} max={downType === 'percent' ? 95 : 1e9} step={home ? 5 : 0.01} />
      {downType === 'percent' && <Field><FieldLabel className="sr-only" htmlFor="down-slider"> {t("Down payment percentage slider")} </FieldLabel><Slider id="down-slider" aria-label={t("Down payment percentage")} value={[Number(down) || (home ? 10 : 0)]} onValueChange={value => setDown(String(value[0]))} min={home ? 10 : 0} max={95} step={5} /><FieldDescription>{home ? t("Minimum 10%, adjustable in 5% steps.") : t("Adjust in 5% steps, or enter an exact percentage above.")}</FieldDescription></Field>}
      {!home && <NumberField label={t("Trade-in value")} suffix={currency} value={tradeIn} onChange={setTradeIn} hint={t("Net equity after any existing vehicle loan is paid off.")} />}
      <div className="grid gap-5 sm:grid-cols-2"><SelectField label={t("Loan term preset")} value={[...(home ? [120, 180, 240, 300, 360] : [12, 24, 36, 48, 60, 72, 84])].includes(Number(months)) ? months : 'custom'} onChange={value => { if (value !== 'custom') setMonths(value); }} options={[...(home ? [120, 180, 240, 300, 360] : [12, 24, 36, 48, 60, 72, 84]).map(value => ({ value: String(value), label: t('{years} years · {months} months', { years: value / 12, months: value }) })), { value: 'custom', label: t("Custom term") }]} /><NumberField label={t("Term in months")} value={months} onChange={setMonths} min={1} max={600} step={1} /></div>
      <NumberField label={t("Annual interest rate")} value={rate} onChange={setRate} max={100} suffix="%" hint={t("Illustrative default. Replace with your lender’s nominal annual rate, not CAT or APR including fees.")} />
    </FieldGroup></div>
    <div className="lg:col-span-2 lg:sticky lg:top-8"><section className="result-panel" aria-label={t("Loan result")} aria-live="polite" aria-atomic="true"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">{mode === 'payment' ? t("Your monthly payment") : t("Your purchasing power")}</h2><Icon size={22} strokeWidth={1.5} /></div>
      {result ? <><p className="result-value">{money(mode === 'payment' ? result.payment : result.price, currency, locale)}</p><p className="-mt-3 text-xs text-muted-foreground">{currency} · {mode === 'payment' ? t("principal & interest") : t("estimated purchase price")}</p><Separator /><dl><ResultRow label={t("Purchase price")} value={money(result.price, currency, locale)} /><ResultRow label={t("Down payment")} value={money(result.downCash, currency, locale)} />{!home && <ResultRow label={t("Trade-in equity")} value={money(Number(tradeIn), currency, locale)} />}<ResultRow label={t("Amount financed")} value={money(result.principal, currency, locale)} /><ResultRow label={deposits.length ? t("Initial monthly payment") : t("Monthly payment")} value={money(result.payment, currency, locale)} /><ResultRow label={t("Final payment (rounding adjusted)")} value={money(rows.at(-1)?.payment ?? 0, currency, locale)} />{deposits.length > 0 && <><ResultRow label={t("Extra principal applied")} value={money(deposited, currency, locale)} /><ResultRow label={t("Number of payments")} value={String(rows.length)} /><ResultRow label={t("Payments saved")} value={String(Math.max(0, baseline.length - rows.length))} /><ResultRow label={t("Interest saved")} value={money(interestSaved, currency, locale)} />{strategy === 'payment' && firstDepositIndex >= 0 && <ResultRow label={t("Payment after first deposit")} value={money(rows[firstDepositIndex + 1]?.payment ?? 0, currency, locale)} />}</>}<ResultRow label={t("Total interest")} value={money(result.interest, currency, locale)} /><ResultRow label={t("Total cost incl. down payment")} value={money(result.total, currency, locale)} /></dl><Button variant="outline" onClick={exportCSV}><Download data-icon="inline-start" /> {t("Download payment schedule")} </Button></> : <Alert variant="destructive"><AlertTitle> {t("Check your numbers")} </AlertTitle><AlertDescription>{t(error)}</AlertDescription></Alert>}
    </section><p className="mt-5 text-xs leading-6 text-muted-foreground"> {t("Estimates assume a fixed interest rate and monthly payments. Insurance, taxes, origination fees,")} {home ? t("notary and closing costs") : t("registration and dealer fees")} {t("are not included. Changing currency changes the label, not the exchange value.")} </p></div>
  </div>
  <section className="rounded-2xl border bg-card p-6 sm:p-8" aria-labelledby="principal-deposits-heading">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 id="principal-deposits-heading" className="subheading"> {t("Extra principal payments")} </h2><p className="mt-2 text-sm text-muted-foreground"> {t("Add deposits to see how much interest and time you could save.")} </p></div><Button variant="outline" onClick={() => setDeposits(current => [...current, { id: Math.max(0, ...current.map(item => item.id)) + 1, month: '1', amount: '10000' }])}><Plus aria-hidden="true" /> {t("Add principal deposit")} </Button></div>
    <FieldGroup><Field><FieldLabel> {t("What should your deposits reduce?")} </FieldLabel><ToggleGroup type="single" value={strategy} onValueChange={value => { if (value) setStrategy(value as 'term' | 'payment'); }} variant="outline" className="w-full sm:w-fit" aria-label={t("Principal deposit strategy")}><ToggleGroupItem value="term" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("Number of payments")} </ToggleGroupItem><ToggleGroupItem value="payment" className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-center"> {t("Monthly payment")} </ToggleGroupItem></ToggleGroup><FieldDescription>{strategy === 'term' ? t("Keep the scheduled payment and pay off the loan sooner.") : t("Recalculate the next monthly payment over the original remaining term.")}</FieldDescription></Field>
    {deposits.map((deposit, index) => <div key={deposit.id} className="grid items-start gap-4 rounded-xl border p-4 sm:grid-cols-3"><NumberField label={t('Deposit {n} month', { n: index + 1 })} value={deposit.month} onChange={value => updateDeposit(deposit.id, 'month', value)} min={1} max={Number(months) || 600} step={1} /><NumberField label={t('Deposit {n} amount', { n: index + 1 })} value={deposit.amount} onChange={value => updateDeposit(deposit.id, 'amount', value)} suffix={currency} /><Button variant="ghost" className="self-end justify-self-start" aria-label={t('Remove deposit {n}', { n: index + 1 })} onClick={() => setDeposits(current => current.filter(item => item.id !== deposit.id))}><Trash2 aria-hidden="true" /> {t("Remove deposit")} </Button></div>)}
    <p className="text-sm leading-6 text-muted-foreground"> {t("Deposits go entirely toward principal after that month’s scheduled payment. Amounts are capped at the remaining balance; deposits after payoff are not applied. No prepayment fees are included. Cent rounding may shorten the remaining term for very small balances.")} {mode === 'power' && t("Purchasing power uses your original monthly budget; extra deposits change repayment, not the purchase price.")}</p></FieldGroup>
  </section>
  {result && <div><Button variant="outline" onClick={() => setShowSchedule(!showSchedule)} aria-expanded={showSchedule} aria-controls="schedule">{showSchedule ? t("Hide") : t("View")} {t("payment schedule")} </Button>{showSchedule && <div id="schedule" className="mt-6 rounded-xl border"><Table><TableHeader><TableRow><TableHead> {t("Month")} </TableHead><TableHead> {t("Scheduled payment")} </TableHead><TableHead> {t("Extra principal")} </TableHead><TableHead> {t("Total payment")} </TableHead><TableHead> {t("Principal")} </TableHead><TableHead> {t("Interest")} </TableHead><TableHead> {t("Balance")} </TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{money(row.payment, currency, locale)}</TableCell><TableCell>{money(row.extraPayment, currency, locale)}</TableCell><TableCell>{money(row.totalPayment, currency, locale)}</TableCell><TableCell>{money(row.principal, currency, locale)}</TableCell><TableCell>{money(row.interest, currency, locale)}</TableCell><TableCell>{money(row.balance, currency, locale)}</TableCell></TableRow>)}</TableBody></Table></div>}</div>}
  </div>;
}

export default function LoanCalculator({ locale = 'en', ...props }: { kind: 'auto' | 'home' } & { locale?: Locale }) {
  return <LocaleProvider locale={locale}><LoanCalculatorContent {...props} /></LocaleProvider>;
}
