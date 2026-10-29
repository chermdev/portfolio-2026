export type Currency = 'MXN' | 'USD';
export type RadarPlan = 'lite' | 'standard' | 'plus' | 'pro';
export type FeeConfig = {
  percent: number; fixed: number; radar: number; international: number;
  conversion: number; tax: number; extra: number;
};
export const stripePresets = {
  MXN: { label: 'Mexico · MXN', percent: 3.6, fixed: 3, international: 0.5, conversion: 2, tax: 16,
    radar: { lite: 0, standard: 0.95, plus: 1.3, pro: 1.6 }, abuse: 0.09 },
  USD: { label: 'United States · USD', percent: 2.9, fixed: 0.3, international: 1.5, conversion: 1, tax: 0,
    radar: { lite: 0, standard: 0.05, plus: 0.07, pro: 0.09 }, abuse: 0.005 },
} as const;
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
function finiteRange(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}.`);
}
export function validateFees(config: FeeConfig) {
  for (const [key, value] of Object.entries(config)) finiteRange(value, 0, ['fixed', 'radar', 'extra'].includes(key) ? 1e6 : 100, key);
  if ((config.percent + config.international + config.conversion) / 100 * (1 + config.tax / 100) >= 1) {
    throw new Error('The combined percentage and fee tax must be below 100%.');
  }
}
export function stripeFees(gross: number, config: FeeConfig) {
  finiteRange(gross, 0, 1e9, 'Amount');
  validateFees(config);
  if (gross === 0) return { gross: 0, processing: 0, radar: 0, extra: 0, tax: 0, fee: 0, net: 0 };
  const processing = roundMoney(gross * (config.percent + config.international + config.conversion) / 100 + config.fixed);
  const radar = roundMoney(config.radar);
  const extra = roundMoney(config.extra);
  const tax = roundMoney((processing + radar + extra) * config.tax / 100);
  const fee = roundMoney(processing + radar + extra + tax);
  return { gross: roundMoney(gross), processing, radar, extra, tax, fee, net: roundMoney(gross - fee) };
}
/** Minimum charge in whole cents whose rounded net meets the target. */
export function grossForNet(net: number, config: FeeConfig) {
  finiteRange(net, 0, 1e9, 'Net amount');
  validateFees(config);
  if (net === 0) return 0;
  const target = Math.ceil(net * 100 - 1e-7);
  const ratio = 1 - (config.percent + config.international + config.conversion) / 100 * (1 + config.tax / 100);
  const estimate = (target / 100 + (config.fixed + roundMoney(config.radar) + roundMoney(config.extra)) * (1 + config.tax / 100)) / ratio;
  if (estimate > 1e9) throw new Error('The required charge exceeds the supported maximum of 1 billion.');
  let low = 0;
  let high = Math.min(1e11, Math.ceil((estimate + 0.04 / ratio) * 100));
  // Rounded tax can create a one-cent dip; find the neighborhood analytically,
  // then inspect each cent instead of assuming strict monotonicity.
  low = Math.max(1, Math.floor((estimate - 0.04 / ratio) * 100));
  if (high - low > 100000) throw new Error('The effective fee is too close to 100%. Reduce the rate.');
  for (let cents = low; cents <= high; cents++) {
    if (Math.round(stripeFees(cents / 100, config).net * 100) >= target) return cents / 100;
  }
  throw new Error('Unable to calculate a charge with these rates.');
}
function validateLoan(principal: number, annualRate: number, months: number) {
  finiteRange(principal, 0, 1e9, 'Principal');
  finiteRange(annualRate, 0, 100, 'Annual interest');
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error('Term must be 1–600 whole months.');
}
export function monthlyPayment(principal: number, annualRate: number, months: number) {
  validateLoan(principal, annualRate, months);
  const rate = annualRate / 1200;
  return rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
}
export function purchasingPrincipal(monthly: number, annualRate: number, months: number) {
  validateLoan(monthly, annualRate, months);
  const rate = annualRate / 1200;
  const value = rate === 0 ? monthly * months : monthly * -Math.expm1(-months * Math.log1p(rate)) / rate;
  finiteRange(value, 0, 1e9, 'Purchasing principal');
  return value;
}
export function loanScenario(input: {
  mode: 'payment' | 'power'; amount: number; annualRate: number; months: number;
  down: number; downType: 'percent' | 'cash'; tradeIn: number;
}) {
  const { mode, amount, annualRate, months, down, downType, tradeIn } = input;
  finiteRange(amount, 0, 1e9, 'Amount');
  finiteRange(tradeIn, 0, 1e9, 'Trade-in');
  finiteRange(down, 0, downType === 'percent' ? 95 : 1e9, 'Down payment');
  const principal = mode === 'power' ? purchasingPrincipal(amount, annualRate, months) : amount - (downType === 'percent' ? amount * down / 100 : down) - tradeIn;
  if (principal < 0) throw new Error('Down payment and trade-in cannot exceed the purchase price.');
  const price = mode === 'payment' ? amount : downType === 'percent' ? (principal + tradeIn) / (1 - down / 100) : principal + down + tradeIn;
  finiteRange(price, 0, 1e9, 'Purchase price');
  const downCash = downType === 'percent' ? price * down / 100 : down;
  const payment = monthlyPayment(principal, annualRate, months);
  return { price, principal, downCash, payment, interest: payment * months - principal, total: payment * months + downCash + tradeIn };
}
export type PrincipalDeposit = { month: number; amount: number };
export type AmortizationOptions = {
  deposits?: PrincipalDeposit[];
  strategy?: 'term' | 'payment';
};
export function amortization(principal: number, annualRate: number, months: number, options: AmortizationOptions = {}) {
  let payment = roundMoney(monthlyPayment(principal, annualRate, months));
  if (principal > 0 && payment <= roundMoney(principal * annualRate / 1200)) {
    throw new Error('This payment does not reduce the balance at cent precision. Choose a shorter term, lower rate, or larger loan.');
  }
  const strategy = options.strategy ?? 'term';
  if (strategy !== 'term' && strategy !== 'payment') throw new Error('Choose a valid deposit strategy.');
  const deposits = new Map<number, number>();
  for (const deposit of options.deposits ?? []) {
    if (!Number.isInteger(deposit.month) || deposit.month < 1 || deposit.month > months) throw new Error(`Deposit month must be between 1 and ${months}.`);
    finiteRange(deposit.amount, 0, 1e9, 'Principal deposit');
    deposits.set(deposit.month, roundMoney((deposits.get(deposit.month) ?? 0) + roundMoney(deposit.amount)));
  }
  let balance = roundMoney(principal);
  const rows: { month: number; payment: number; extraPayment: number; totalPayment: number; principal: number; interest: number; balance: number }[] = [];
  for (let month = 1; month <= months && balance > 0; month++) {
    const interest = roundMoney(balance * annualRate / 1200);
    const paid = month === months ? roundMoney(balance + interest) : Math.min(payment, roundMoney(balance + interest));
    const regularCapital = roundMoney(paid - interest);
    const extraPayment = Math.min(deposits.get(month) ?? 0, Math.max(0, roundMoney(balance - regularCapital)));
    const capital = roundMoney(regularCapital + extraPayment);
    balance = Math.max(0, roundMoney(balance - capital));
    rows.push({ month, payment: paid, extraPayment, totalPayment: roundMoney(paid + extraPayment), principal: capital, interest, balance });
    // Deposits follow the scheduled installment; a recast affects the next month.
    if (strategy === 'payment' && extraPayment > 0 && balance > 0 && month < months) {
      // Even a tiny balance must repay at least one cent of principal per month.
      const minimumPayment = roundMoney(roundMoney(balance * annualRate / 1200) + 0.01);
      payment = Math.max(minimumPayment, roundMoney(monthlyPayment(balance, annualRate, months - month)));
    }
  }
  return rows;
}
