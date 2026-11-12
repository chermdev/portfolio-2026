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
export type Compounding = 1 | 12 | 365;
/** Month-by-month savings balance with end-of-month contributions. */
export function savingsGrowth(input: { initial: number; monthly: number; annualRate: number; years: number; compounding: Compounding }) {
  const { initial, monthly, annualRate, years, compounding } = input;
  finiteRange(initial, 0, 1e9, 'Initial deposit');
  finiteRange(monthly, 0, 1e9, 'Monthly contribution');
  finiteRange(annualRate, 0, 100, 'Annual interest');
  if (!Number.isInteger(years) || years < 1 || years > 60) throw new Error('Years must be 1–60 whole years.');
  if (![1, 12, 365].includes(compounding)) throw new Error('Choose a valid compounding frequency.');
  // Equivalent monthly rate for the chosen compounding, so contributions can stay monthly.
  const rate = Math.expm1(compounding / 12 * Math.log1p(annualRate / 100 / compounding));
  const deposit = roundMoney(monthly);
  // Accrue unrounded so cent rounding never compounds; rounded rows still reconcile exactly.
  let exact = roundMoney(initial);
  const rows: { month: number; contribution: number; interest: number; balance: number }[] = [];
  for (let month = 1; month <= years * 12; month++) {
    const previous = roundMoney(exact);
    exact = exact * (1 + rate) + deposit;
    const balance = roundMoney(exact);
    // Doubles lose cent precision long before Infinity; refuse figures that would look exact but are not.
    if (balance > 1e12) throw new Error('The balance exceeds 1 trillion, where cent precision is lost. Shorten the term or lower the rate.');
    rows.push({ month, contribution: deposit, interest: roundMoney(balance - previous - deposit), balance });
  }
  return rows;
}
/** Monthly ISR tariff, Art. 96 LISR, Anexo 8 RMF 2026 (DOF 28 Dec 2025): [lower limit, fixed fee, % on the excess]. */
export const isrMonthly2026 = [
  [0.01, 0, 1.92], [844.6, 16.22, 6.4], [7168.52, 420.95, 10.88], [12598.03, 1011.68, 16], [14644.65, 1339.14, 17.92],
  [17533.65, 1856.84, 21.36], [35362.84, 5665.16, 23.52], [55736.69, 10457.09, 30], [106410.51, 25659.23, 32],
  [141880.67, 37009.69, 34], [425642, 133488.54, 35],
] as const;
/** Employment subsidy decree (DOF 31 Dec 2025): 15.02% of the 2026 monthly UMA (3,566.22), February–December. */
export const employmentSubsidy2026 = { amount: 535.65, cap: 11492.66 };
/** Monthly ISR withheld from a salary. The subsidy only reduces the tax; it is never paid out as cash. */
export function salaryIsr(amount: number, subsidy: { amount: number; cap: number }) {
  finiteRange(amount, 0, 1e9, 'Income');
  // Bands are defined in cents; round first so the band and the displayed amount agree.
  const income = roundMoney(amount);
  finiteRange(subsidy.amount, 0, 1e6, 'Employment subsidy');
  finiteRange(subsidy.cap, 0, 1e9, 'Subsidy cap');
  const row = [...isrMonthly2026].reverse().find(([lower]) => income >= lower);
  if (!row) return { income, lower: 0, fixed: 0, rate: 0, tax: 0, subsidy: 0, withheld: 0, net: roundMoney(income) };
  const [lower, fixed, rate] = row;
  const tax = roundMoney(fixed + (income - lower) * rate / 100);
  const applied = income <= subsidy.cap ? Math.min(roundMoney(subsidy.amount), tax) : 0;
  const withheld = roundMoney(tax - applied);
  return { income: roundMoney(income), lower, fixed, rate, tax, subsidy: applied, withheld, net: roundMoney(income - withheld) };
}
/** RESICO individuals, Art. 113-E LISR: [monthly income up to, rate %]. The rate applies to all of the month's income, not just the excess. */
export const resicoMonthly = [[25000, 1], [50000, 1.1], [83333.33, 1.5], [208333.33, 2], [3500000, 2.5]] as const;
/** RESICO stops applying once yearly income exceeds this amount. */
export const resicoAnnualLimit = 3500000;
export function resicoTax(amount: number, paid: number, retention: number) {
  finiteRange(amount, 0, 1e9, 'Income');
  finiteRange(paid, 0, 1e9, 'Income from companies');
  const income = roundMoney(amount), companies = roundMoney(paid);
  finiteRange(retention, 0, 100, 'Withholding rate');
  if (companies > income) throw new Error('Income from companies cannot exceed total income.');
  const index = resicoMonthly.findIndex(([max]) => income <= max);
  // Above 3.5 million the regime no longer applies; keep the top rate and let the caller flag the annual limit.
  const band = index === -1 ? resicoMonthly.length - 1 : index;
  const rate = resicoMonthly[band][1];
  const tax = roundMoney(income * rate / 100);
  const withheld = roundMoney(companies * retention / 100);
  return {
    rate, tax, withheld, payment: roundMoney(Math.max(0, tax - withheld)), credit: roundMoney(Math.max(0, withheld - tax)),
    // Income still taxed at this rate; null in the top band.
    headroom: band < resicoMonthly.length - 1 ? roundMoney(resicoMonthly[band][0] - income) : null,
  };
}
/**
 * Social security on a salary, 2026 (Ley del Seguro Social, Ley del INFONAVIT; rates checked against
 * two published 2026 IMSS tables). UMA 117.31 (INEGI, from 1 Feb 2026); general minimum wage 315.04 (DOF 9 Dec 2025).
 * `integration` turns the daily salary into the SBC: 1.0493 = (365 + 15 days of aguinaldo + 25% of 12 vacation days) / 365, the first-year legal minimum.
 */
export const socialSecurity2026 = { uma: 117.31, minimumWage: 315.04, integration: 1.0493, riskPremium: 0.54355, days: 30.4 };
/** Employer old-age contribution (cesantía y vejez) for 2026, by SBC: up to 1 minimum wage, then [SBC in UMAs up to, rate %]. */
export const oldAgeEmployer2026 = { minimumWageRate: 3.15, bands: [[1.5, 3.676], [2, 4.851], [2.5, 5.556], [3, 6.026], [3.5, 6.361], [4, 6.613], [Infinity, 7.513]] as const };
export function payrollContributions(amount: number, options: { uma: number; minimumWage: number; integration: number; riskPremium: number; days: number }) {
  finiteRange(amount, 0, 1e9, 'Income');
  finiteRange(options.uma, 1, 1e4, 'UMA');
  finiteRange(options.minimumWage, 1, 1e4, 'Minimum wage');
  finiteRange(options.integration, 1, 2, 'Integration factor');
  finiteRange(options.riskPremium, 0, 15, 'Work risk premium');
  const { uma, minimumWage, integration, riskPremium, days } = options;
  if (amount <= 0) return { sbc: 0, oldAgeRate: 0, paysEmployeeShare: false, employee: 0, employer: { imss: 0, retirement: 0, infonavit: 0, total: 0 } };
  // A monthly salary becomes daily pay over 30 days (LFT Art. 89); contributions accrue over the average 30.4-day month.
  const daily = amount / 30;
  // The SBC never drops below the minimum wage and is capped at 25 UMA (Art. 28 LSS).
  const sbc = Math.min(Math.max(daily * integration, minimumWage), 25 * uma);
  const base = sbc * days, excess = Math.max(0, sbc - 3 * uma) * days;
  const share = (rate: number, on = base) => on * rate / 100;
  // Employee: medical excess, cash benefits, pensioners' medical care, disability and life, old age.
  const employee = share(0.4, excess) + share(0.25) + share(0.375) + share(0.625) + share(1.125);
  const oldAge = sbc <= minimumWage ? oldAgeEmployer2026.minimumWageRate : oldAgeEmployer2026.bands.find(([max]) => sbc / uma <= max)![1];
  const imss = share(20.4, uma * days) + share(1.1, excess) + share(0.7) + share(1.05) + share(1.75) + share(riskPremium) + share(1);
  const retirement = share(2) + share(oldAge);
  const infonavit = share(5);
  // Art. 36 LSS: for a minimum-wage worker the employer also pays the employee's share.
  const paysEmployeeShare = daily <= minimumWage;
  // Round each part first so the total equals the parts shown.
  const employer = { imss: roundMoney(imss + (paysEmployeeShare ? employee : 0)), retirement: roundMoney(retirement), infonavit: roundMoney(infonavit) };
  return {
    sbc: roundMoney(sbc), oldAgeRate: oldAge, paysEmployeeShare,
    employee: paysEmployeeShare ? 0 : roundMoney(employee),
    employer: { ...employer, total: roundMoney(employer.imss + employer.retirement + employer.infonavit) },
  };
}
