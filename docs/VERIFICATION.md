# Verification record

Checked September 26, 2026. Evidence applies to this implementation and the local production preview, not a published domain.

| Area | Evidence | Outcome |
| --- | --- | --- |
| Workspace | Frozen pnpm install; exact package-manager version and restricted build scripts | Install succeeds with lockfile |
| Type safety | `pnpm check` across four Astro apps and shared UI | No diagnostics |
| Production output | `pnpm build`, `pnpm verify:build` | Four app builds; 20 HTML pages checked for metadata, local links, single h1, OG image dimensions and tool schema |
| Financial logic | `pnpm test` | Eight tests: forward/reverse fees, rounding, known loan payment, purchasing power, zero-interest behavior, invalid inputs and amortization reconciliation |
| Independent domain review | Read-only calculator review, followed by regression tests | Both findings fixed: reverse Stripe targets with sub-cent input and schedules that cannot amortize at cent precision |
| Calculator UI | `artifacts/qa/browser-checks.js` | MXN/USD presets, Radar/custom rates, inverse results, invalid inputs, loan modes, down-payment constraints, schedule and CSV export passed |
| Responsive layout | `artifacts/qa/layout-checks.js` | Ten routes checked at 320px and 390px without horizontal page overflow; desktop inspected at 1440px |
| Accessibility and motion | Browser interactions and screenshots | Mobile navigation and Escape dismissal, visible keyboard focus, theme persistence, sculpture pause/material controls and reduced-motion still verified |
| Component reference | `artifacts/qa/gallery-checks.js` | All 61 previews mounted without page errors; dialog opening and Escape dismissal checked |
| Share images | Eight 1200×630 cards and their 400×210 proofs | Same typography, color tokens and actual sculpture; thumbnail titles readable |
| Dependencies | `pnpm audit --json`, `pnpm outdated -r --format json` | Zero reported vulnerabilities. TypeScript 6 remains intentional for Astro checker compatibility |

## Design review

| Finding during implementation | Final behavior |
| --- | --- |
| Astro static slots did not forward React `asChild` anchor styles | Astro links now use shared `buttonVariants()` |
| Broad component transitions could animate unintended properties | Transitions name specific properties; keyboard feedback and reduced motion suppress movement |
| Theme swaps could animate the whole page | Page transitions are suppressed during the swap; toast theme follows the same root class |
| A gallery component required context | Its preview now supplies the required provider; all previews mount |
| A captured sculpture still was initially blank | Replaced with a verified capture from the rendered Three.js canvas |

Screenshots and runnable browser check scripts are in `artifacts/qa`. Open Graph SVG sources and thumbnail proofs are in `apps/web/artifacts/og`. The generated PNGs are in `apps/web/public/og`.

The implemented main states are approved for local review. Coverage does not include every interaction state in all 61 shadcn primitives, physical-device testing, a formal accessibility audit, or a slowed browser Animations-panel review. Browser checks use Chromium. Bundle-size notices remain for the Three.js and full component-gallery chunks; these load only where needed.

## Configuration still required

The real domain and hosting account are not configured. Default `portfolio.example` builds are deliberately noindex. Set the app origins and rebuild before publishing; public crawler behavior and social-platform cache refreshes need testing on the deployed domain.

Blog and learn are independent apps with introductory content. Admin is an inactive shell with no private data, authentication, or administrative actions. Add server-side authentication and authorization before implementing private management features.

The available official shadcn catalog is installed. Its `questionnaire` entry was unavailable for the chosen `new-york-v4` registry style; the gallery identifies this upstream limitation.

## Principal deposits update

Both loan calculators now accept multiple month/amount deposits and compare the adjusted schedule against the same loan without deposits. Deposits apply after the scheduled installment, aggregate within the month, cap at remaining principal, and stop at payoff. Reduce-term keeps the original installment; reduce-payment recasts the next installment over the original remaining term. A cent-precision minimum ensures a recast always reduces principal. Purchasing power remains based on the original monthly budget.

The financial suite now has 14 passing tests, including independent interest-bearing examples, duplicate/oversized/final-month deposits, zero interest, invalid entries and tiny-balance recasts. Independent domain review checked 96 combinations and identified the tiny-balance issue fixed by that regression. Browser evidence is in `artifacts/qa/principal-deposits-checks.js`; exported CSVs include separate scheduled, extra, total, principal, interest and balance columns.

Browser checks passed for both tools on the existing port 3006 server: term reduction, payment recast, schedule row counts, CSV values, duplicate/capped deposits, invalid-month suppression and recovery, purchasing-power mode, removal and mobile layout. Both downloaded CSVs were independently parsed to verify 12 installments, the 3,000 deposit, the following 727.27 payment and zero final balance. No application page errors occurred; the test's initial incorrect mortgage URL produced a 404 before its route was corrected.

## Saved calculators, neutral themes and Spanish

Zustand is installed with separate versioned stores for Stripe, auto and mortgage. Browser checks verified saved amounts, custom fee rates, toggles, deposits and strategies after reload; values survive English/Spanish navigation. Reset restores only the active tool and persists that reset. Invalid JSON, invalid nested draft shapes and blocked localStorage do not prevent calculator use. No computed outputs are persisted.

The suite now has 17 passing tests: 14 existing financial tests plus locale routing, placeholder/validation translation and server-rendered translation boundaries. All four app builds and type checks pass. The built-output verifier checks 40 pages, including both language alternatives and localized 1200×630 share images. Spanish CSVs were downloaded and parsed to verify translated headers, saved deposits and payoff balances.

`artifacts/qa/persistence-language-checks.js` exercises the main flows on the existing port 3006 server. Both themes and 320/390px Spanish tool layouts were checked; longer mode labels wrap within their controls. `gallery-spanish-checks.js` mounted all 61 translated component previews without page errors and checked dialog keyboard dismissal. Source API names remain in English.

These changes do not alter financial formulas. The prior independent financial review remains applicable. Persistence is per browser/origin, and unavailable storage falls back to in-memory editing. Public deployment, DNS and admin authentication remain unconfigured.

Dependency audit reported zero vulnerabilities and frozen-lockfile installation passed. Dev and build Vite caches are now separated: production builds previously invalidated optimized dependency URLs used by the running dev server. Browser verification should wait for React hydration when testing interactive islands.
