# chermdev

A minimalist developer portfolio, useful financial tools, and room for experiments. Built with Astro, React islands, Tailwind CSS, shadcn, GSAP, and Three.js.

## Run locally

Node 22.12+ and Corepack are required. The repository pins pnpm 10.34.5.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The main site runs at `http://localhost:4321`. Astro 7 runs it in the background; stop it with `pnpm --filter @portfolio/web exec astro dev stop`.

```sh
pnpm --filter @portfolio/blog dev   # :4322
pnpm --filter @portfolio/learn dev  # :4323
pnpm --filter @portfolio/admin dev # :4324
```

## Included

- Portfolio landing page, project gallery, and an interactive Three.js material study.
- `/tools/stripe-calculator`: Mexico/MXN and US/USD presets, editable processing/Radar/surcharge/tax values, forward and reverse calculations.
- `/tools/auto-loan-calculator`: monthly payments, purchasing power, cash/percentage down payment, trade-in equity, downloadable amortization.
- `/tools/mortgage-calculator`: both modes, 10–95% down payment in 5% steps, downloadable amortization.
- Both loan simulators support multiple extra principal deposits, lower-payment or shorter-term strategies, interest savings, and adjusted schedule/CSV totals.
- `/system-design`: shared color/layout tokens and 61 live official shadcn component previews. The upstream questionnaire entry for the selected style is unavailable.
- Blog and learning apps, with root-site previews at `/notes` and `/learn`.
- An inactive admin app with no private data or management endpoints. Add authentication before real admin features.
- White/neutral-black themes, mobile navigation, reduced-motion stills, and pausable WebGL.
- English root routes and Spanish `/es` routes, with translated metadata, tool inputs, validation and CSV headers.
- Independent Zustand localStorage drafts for every calculator, including deposits, plus per-tool reset buttons. Inputs stay on the same browser/origin; clearing browser storage removes them.
- SEO metadata, sitemap/robots, tool structured data, and sixteen Open Graph cards (English and Spanish).

## Workspace

```text
apps/web              portfolio and tools
apps/blog             notes subdomain
apps/learn            guides subdomain
apps/admin            reserved admin subdomain
packages/site         shared site shell and editorial content
packages/ui           design tokens, shadcn components, gallery
packages/calculators  framework-independent financial engine
packages/i18n         shared English/Spanish translations and server middleware
```

Each app has its own deployment boundary. Future apps can use Next.js or other stacks. A monorepo does not configure DNS or route between deployments; see [architecture and deployment](docs/ARCHITECTURE.md).

## Production URLs

Copy `.env.example` into each app as `.env`, or set values in your host. Set `PUBLIC_SITE_URL` to that app’s production origin. Subdomain apps also need `PUBLIC_PORTFOLIO_URL`. `PUBLIC_BLOG_URL` and `PUBLIC_LEARN_URL` switch navigation from local previews to subdomains.

Unconfigured builds deliberately use `portfolio.example` and `noindex`. Set real origins and rebuild to enable indexing. Root-site copies of blog/learn pages then canonicalize to their configured subdomains and remain noindex. No hosting deployment or DNS changes have been made.

## Commands

```sh
pnpm check         # Astro diagnostics and all shared UI TypeScript
pnpm test          # financial formula and rounding tests
pnpm build         # all four apps
pnpm verify:build  # generated HTML, local links, metadata, OG assets
pnpm og            # regenerate share cards and thumbnail proofs
pnpm audit         # dependency vulnerability check
pnpm preview --port 4173
```

Read [DESIGN.md](DESIGN.md) before UI changes and [AGENTS.md](AGENTS.md) for working conventions. Verification evidence is in `docs/VERIFICATION.md` and `artifacts/qa`.

## Share images

`apps/web/scripts/generate-og.mjs` reads the shared color tokens, renders the actual Manrope 500 font as vector paths, and composes it with `apps/web/public/sculpture.png`, captured from the live Three.js scene. Editable SVG sources and 400×210 proofs are in `apps/web/artifacts/og`; 1200×630 PNGs are in `apps/web/public/og`.

## Financial assumptions

Stripe presets were checked against official US/Mexico payment and Radar pricing on September 26, 2026. The UI links to sources. Every fee field is editable. Subscription/account charges, blocked-screening volume, disputes, installments, and refunds are excluded from the per-successful-payment estimate. Pro abuse-event costs can be allocated manually.

Loan rates are illustrative, not lender quotes. Calculations use fixed nominal annual interest and monthly payments; taxes, insurance, and lender-specific costs are excluded. Totals come from the rounded schedule, which shows the final adjusted installment. Configurations that do not amortize at cent precision are rejected.
