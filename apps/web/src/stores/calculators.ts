import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { stripePresets, type Currency, type RadarPlan, type FeeConfig } from '@portfolio/calculators';
export type Draft = Record<keyof FeeConfig, string>;
export function feeDefaults(currency: Currency, plan: RadarPlan): Draft {
  const p = stripePresets[currency];
  return { percent: String(p.percent), fixed: String(p.fixed), radar: String(p.radar[plan]), international: String(p.international), conversion: String(p.conversion), tax: String(p.tax), extra: '0' };
}
export const stripeDefaults = () => ({ currency: 'MXN' as Currency, plan: 'lite' as RadarPlan, draft: feeDefaults('MXN', 'lite'), international: false, conversion: false, mode: 'charge', amount: '1000' });
export const loanDefaults = (home: boolean) => ({ mode: 'payment' as 'payment' | 'power', price: home ? '2500000' : '450000', budget: home ? '20000' : '8000', currency: 'MXN', down: '20', downType: 'percent' as 'percent' | 'cash', tradeIn: '0', rate: home ? '10.5' : '12', months: home ? '240' : '60', showSchedule: false, deposits: [] as { id: number; month: string; amount: string }[], strategy: 'term' as 'term' | 'payment' });
type Update<T> = T | ((previous: T) => T);
// Persist inputs only. Derived results are recomputed; each tool has its own key.
function calculatorStore<T extends object>(name: string, defaults: () => T) {
  return create(persist<{ values: T; set: <K extends keyof T>(key: K, value: Update<T[K]>) => void; reset: () => void }>((set) => ({
    values: defaults(),
    set: (key, value) => set(state => ({ values: { ...state.values, [key]: typeof value === 'function' ? (value as (previous: T[typeof key]) => T[typeof key])(state.values[key]) : value } })),
    reset: () => set({ values: defaults() }),
  }), {
    name, version: 1, storage: createJSONStorage(() => ({
      getItem: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
      setItem: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Keep the calculator usable when storage is unavailable. */ } },
      removeItem: (key: string) => { try { localStorage.removeItem(key); } catch {} },
    })), skipHydration: true,
    partialize: state => ({ values: state.values }) as typeof state,
    merge: (persisted, current) => {
      const saved = (persisted as { values?: unknown } | null)?.values;
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return current;
      const base = defaults();
      // Discard malformed shapes rather than letting storage break a calculator.
      for (const key of Object.keys(base) as (keyof T)[]) {
        const value = (saved as T)[key];
        if (typeof value !== typeof base[key] || Array.isArray(value) !== Array.isArray(base[key])) return current;
        if (typeof base[key] === 'object' && value === null) return current;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          for (const child of Object.keys(base[key] as object)) if (typeof (value as Record<string, unknown>)[child] !== 'string') return current;
        }
      }
      const selections = saved as Record<string, unknown>;
      const choices: Record<string, string[]> = { currency: ['MXN', 'USD'], plan: ['lite', 'standard', 'plus', 'pro'], mode: name.includes('stripe') ? ['charge', 'receive'] : ['payment', 'power'], downType: ['percent', 'cash'], strategy: ['term', 'payment'] };
      for (const [key, allowed] of Object.entries(choices)) if (key in base && !allowed.includes(String(selections[key]))) return current;
      const deposits = (saved as { deposits?: unknown[] }).deposits;
      if (deposits?.some(item => !item || typeof item !== 'object' || typeof (item as {id?:unknown}).id !== 'number' || typeof (item as {month?:unknown}).month !== 'string' || typeof (item as {amount?:unknown}).amount !== 'string')) return current;
      return { ...current, values: Object.fromEntries(Object.keys(base).map(key => [key, (saved as Record<string, unknown>)[key]])) as T };
    },
  }));
}
export const useStripeStore = calculatorStore('chermdev:calculator:stripe:v1', stripeDefaults);
export const useAutoStore = calculatorStore('chermdev:calculator:auto:v1', () => loanDefaults(false));
export const useMortgageStore = calculatorStore('chermdev:calculator:mortgage:v1', () => loanDefaults(true));
export function useHydrateCalculator(store: typeof useAutoStore | typeof useStripeStore) {
  useEffect(() => { void store.persist.rehydrate(); }, [store]);
}
