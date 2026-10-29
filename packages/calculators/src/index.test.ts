import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeFees, grossForNet, monthlyPayment, purchasingPrincipal, loanScenario, amortization, stripePresets, savingsGrowth } from './index.ts';
test('Mexico processing fee with 16% fee tax', () => {
  assert.deepEqual(stripeFees(1000, { percent: 3.6, fixed: 3, radar: 0, international: 0, conversion: 0, tax: 16, extra: 0 }),
    { gross: 1000, processing: 39, radar: 0, extra: 0, tax: 6.24, fee: 45.24, net: 954.76 });
});
test('reverse fees meet target and cannot be reduced by a cent', () => {
  for (const preset of Object.values(stripePresets)) {
    for (const radar of Object.values(preset.radar)) {
      const config = { percent: preset.percent, fixed: preset.fixed, radar, international: preset.international, conversion: preset.conversion, tax: preset.tax, extra: 0.09 };
      for (const net of [0.01, 1, 99.99, 1000, 123456.78]) {
        const gross = grossForNet(net, config);
        assert.ok(stripeFees(gross, config).net >= net);
        assert.ok(stripeFees(gross - 0.01, config).net < net);
      }
    }
  }
});
test('zero amounts and invalid rates are explicit', () => {
  const config = { percent: 3.6, fixed: 3, radar: 0, international: 0, conversion: 0, tax: 16, extra: 0 };
  assert.equal(stripeFees(0, config).net, 0);
  assert.equal(grossForNet(0, config), 0);
  assert.throws(() => stripeFees(NaN, config));
  assert.throws(() => grossForNet(100, { ...config, percent: 99 }));
  assert.throws(() => stripeFees(-1, config));
});
test('payment formula matches independent known mortgage result', () => {
  assert.ok(Math.abs(monthlyPayment(100000, 6, 360) - 599.550525) < 0.00001);
  assert.equal(monthlyPayment(12000, 0, 12), 1000);
  assert.equal(purchasingPrincipal(1000, 0, 12), 12000);
});
test('purchasing power reverses payment with down payment and trade-in', () => {
  for (const downType of ['percent', 'cash'] as const) {
    const data = { mode: 'payment' as const, amount: 500000, annualRate: 12, months: 60, down: downType === 'percent' ? 20 : 100000, downType, tradeIn: 30000 };
    const result = loanScenario(data);
    const reverse = loanScenario({ ...data, mode: 'power', amount: result.payment });
    assert.ok(Math.abs(reverse.price - data.amount) < 0.01);
  }
});
test('amortization pays off exactly and preserves principal', () => {
  for (const rate of [0, 0.00001, 8.5, 18]) {
    const rows = amortization(123456.78, rate, 60);
    assert.equal(rows.at(-1)?.balance, 0);
    assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.principal, 0) - 123456.78) < 0.01);
    assert.ok(rows.every((row) => row.balance >= 0));
  }
});
test('loan validation rejects invalid states', () => {
  assert.throws(() => monthlyPayment(100, -1, 12));
  assert.throws(() => monthlyPayment(100, 2, 0));
  assert.throws(() => loanScenario({ mode: 'payment', amount: 100, annualRate: 10, months: 12, down: 200, downType: 'cash', tradeIn: 0 }));
  assert.throws(() => amortization(8e8, 100, 600));
});
test('reverse fees handle sub-cent edits and round the target upwards', () => {
  const config = { percent: 99, fixed: 0, radar: 0.005, extra: 0.005, international: 0, conversion: 0, tax: 0 };
  assert.ok(stripeFees(grossForNet(1, config), config).net >= 1);
  const noFixed = { ...config, radar: 0, extra: 0 };
  assert.ok(stripeFees(grossForNet(1.001, noFixed), noFixed).net >= 1.01);
});

test('principal deposits shorten zero-interest loans or recast the next payment', () => {
  const deposits = [{ month: 1, amount: 3000 }];
  const shorter = amortization(12000, 0, 12, { deposits, strategy: 'term' });
  assert.equal(shorter.length, 9);
  assert.deepEqual(shorter[0], { month: 1, payment: 1000, extraPayment: 3000, totalPayment: 4000, principal: 4000, interest: 0, balance: 8000 });
  assert.equal(shorter[1].payment, 1000);
  const lower = amortization(12000, 0, 12, { deposits, strategy: 'payment' });
  assert.equal(lower.length, 12);
  assert.equal(lower[1].payment, 727.27);
  assert.equal(lower.at(-1)?.payment, 727.3);
});
test('deposits follow interest accrual and reconcile both strategies to the cent', () => {
  const baseline = amortization(100000, 12, 24);
  for (const strategy of ['term', 'payment'] as const) {
    const rows = amortization(100000, 12, 24, { strategy, deposits: [{ month: 1, amount: 10000 }, { month: 6, amount: 15000 }] });
    assert.equal(rows[0].interest, 1000);
    assert.equal(rows[0].balance, 100000 - rows[0].principal);
    assert.equal(rows[1].interest, Math.round(rows[0].balance) / 100);
    assert.equal(rows.at(-1)?.balance, 0);
    assert.equal(Math.round(rows.reduce((sum, row) => sum + row.principal, 0) * 100), 10000000);
    assert.ok(rows.reduce((sum, row) => sum + row.interest, 0) < baseline.reduce((sum, row) => sum + row.interest, 0));
    for (const row of rows) assert.equal(Math.round(row.totalPayment * 100), Math.round((row.principal + row.interest) * 100));
    if (strategy === 'term') { assert.ok(rows.length < 24); assert.equal(rows[1].payment, baseline[1].payment); }
    else { assert.equal(rows.length, 24); assert.ok(rows[1].payment < rows[0].payment); assert.ok(rows[6].payment < rows[5].payment); }
  }
});
test('deposits aggregate, cap at payoff, and skip later deposits', () => {
  const rows = amortization(12000, 0, 12, { deposits: [{ month: 1, amount: 5000 }, { month: 1, amount: 20000 }, { month: 2, amount: 3000 }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].extraPayment, 11000);
  assert.equal(rows[0].totalPayment, 12000);
  assert.equal(rows[0].balance, 0);
  assert.equal(amortization(12000, 0, 12, { deposits: [{ month: 12, amount: 1000 }] }).at(-1)?.extraPayment, 0);
  assert.deepEqual(amortization(0, 0, 12, { deposits: [{ month: 1, amount: 100 }] }), []);
  assert.deepEqual(amortization(12000, 5, 12), amortization(12000, 5, 12, { deposits: [{ month: 1, amount: 0 }], strategy: 'payment' }));
});
test('invalid deposits are rejected instead of silently ignored', () => {
  for (const month of [0, 13, 1.5, NaN]) assert.throws(() => amortization(12000, 5, 12, { deposits: [{ month, amount: 100 }] }));
  for (const amount of [-1, NaN, Infinity, 1e9 + 1]) assert.throws(() => amortization(12000, 5, 12, { deposits: [{ month: 1, amount }] }));
});

test('a recast pays down tiny balances instead of charging interest-only installments', () => {
  const rows = amortization(1000, 12, 360, { strategy: 'payment', deposits: [{ month: 1, amount: 999.21 }] });
  assert.equal(rows[0].balance, 0.5);
  assert.ok(rows.slice(1).every(row => row.principal >= 0.01));
  assert.ok(rows.length < 360);
  assert.equal(rows.at(-1)?.balance, 0);
});
test('independent interest-bearing deposit example matches both strategies', () => {
  for (const strategy of ['term', 'payment'] as const) {
    const rows = amortization(12000, 12, 12, { strategy, deposits: [{ month: 1, amount: 2000 }] });
    assert.equal(rows.length, strategy === 'term' ? 10 : 12);
    assert.equal(Math.round(rows.reduce((sum, row) => sum + row.interest, 0) * 100), strategy === 'term' ? 57529 : 67224);
    if (strategy === 'payment') assert.equal(rows[1].payment, 873.28);
  }
});

test('savings growth matches closed-form compound interest and reconciles to the cent', () => {
  // Monthly compounding: FV = P(1+i)^n + PMT((1+i)^n − 1)/i, i = 6%/12, n = 120.
  const rows = savingsGrowth({ initial: 10000, monthly: 500, annualRate: 6, years: 10, compounding: 12 });
  const growth = 1.005 ** 120;
  assert.equal(rows.length, 120);
  assert.ok(Math.abs(rows.at(-1)!.balance - (10000 * growth + 500 * (growth - 1) / 0.005)) < 0.5);
  const deposits = 10000 + rows.reduce((sum, row) => sum + row.contribution, 0);
  const interest = rows.reduce((sum, row) => sum + row.interest, 0);
  assert.equal(Math.round((deposits + interest) * 100), Math.round(rows.at(-1)!.balance * 100));
});
test('savings compounding frequencies use equivalent annual yields', () => {
  const yearly = (compounding: 1 | 12 | 365) => savingsGrowth({ initial: 100000, monthly: 0, annualRate: 10, years: 1, compounding }).at(-1)!.balance;
  assert.equal(yearly(1), 110000);
  assert.ok(Math.abs(yearly(12) - 100000 * (1 + 0.1 / 12) ** 12) < 0.05);
  assert.ok(Math.abs(yearly(365) - 100000 * (1 + 0.1 / 365) ** 365) < 0.05);
  assert.equal(savingsGrowth({ initial: 0, monthly: 100, annualRate: 0, years: 2, compounding: 12 }).at(-1)!.balance, 2400);
});
test('savings validation rejects invalid states', () => {
  const base = { initial: 1000, monthly: 100, annualRate: 5, years: 5, compounding: 12 as const };
  for (const years of [0, 61, 1.5, NaN]) assert.throws(() => savingsGrowth({ ...base, years }));
  for (const annualRate of [-1, 101, NaN]) assert.throws(() => savingsGrowth({ ...base, annualRate }));
  assert.throws(() => savingsGrowth({ ...base, monthly: -1 }));
  assert.throws(() => savingsGrowth({ ...base, compounding: 4 as 12 }));
  assert.throws(() => savingsGrowth({ initial: 1000, monthly: 0, annualRate: 100, years: 60, compounding: 12 }), /1 trillion/);
});
