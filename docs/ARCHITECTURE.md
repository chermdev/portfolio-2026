# Workspace and deployment

This is a pnpm monorepo, with independent app boundaries. A monorepo organizes code; it does not route HTTP requests or configure DNS.

| Package | Responsibility | Deployment |
| --- | --- | --- |
| `apps/web` | Portfolio, projects, tools, design system | Root domain |
| `apps/blog` | Notes and articles | `blog.<domain>` |
| `apps/learn` | Learning guides | `learn.<domain>` |
| `apps/admin` | Inactive administration shell | `admin.<domain>`, protected before real features |
| `packages/ui` | Tailwind tokens and shadcn React components | Compiled into apps |
| `packages/site` | Shared navigation, layouts, and editorial content | Compiled into apps |
| `packages/i18n` | Shared translations, React locale context and static HTML localization | Compiled into apps |
| `packages/calculators` | Pure TypeScript financial logic | Imported by web or future apps |

Astro renders crawlable HTML; React hydrates only interactive controls. Three.js loads on pages containing the sculpture. Future applications can use Next.js, plain React/Vite, another Astro app, or another stack with no root-site rewrite. JavaScript apps can reuse the calculator engine; React apps can reuse all UI components. Non-React apps can reuse CSS tokens but need native components.

Deploy each app as a separate hosting project from the same repository. Install from the workspace root with `pnpm install --frozen-lockfile`, run `pnpm --filter @portfolio/<app> build`, and publish `apps/<app>/dist`. Set the production `PUBLIC_SITE_URL` for that app, `PUBLIC_PORTFOLIO_URL` for the root portfolio, and `PUBLIC_BLOG_URL`/`PUBLIC_LEARN_URL` for cross-links. Environment values are build-time; rebuild after changing them. Copy the relevant variables from `.env.example` into each app's hosting environment (or `apps/<app>/.env` locally).

Assign each hostname in the hosting provider and add its requested DNS record. Those external actions require the real domain and hosting account, which have not yet been supplied. Local root-site `/notes` and `/learn` previews keep navigation working until subdomains are configured.

To serve a different stack at a root route such as `/experiments/ai`, deploy the other app separately and configure a reverse-proxy rewrite at the host. The app must support its base path, including asset paths and cookies. Subdomains are simpler and isolate releases and framework assumptions. Shared authentication should be designed explicitly; do not share broad-domain session cookies by default.

The admin app deliberately contains no authentication form, secrets, data, or administrative endpoints. It is an inactive shell, not a secured CMS. Add server-side authentication and authorization, then enable real management features. `noindex` is not access control. Use hosting access protection before publishing any private content.

## Install notes

pnpm 10.34.5 is pinned on the maintained 10.x line. Node >=22.12 is required. Releases must be at least one day old; exotic transitive sources are blocked; lifecycle scripts are restricted to esbuild and sharp. The lockfile is committed by the next authorized commit.

The exact legacy `chokidar@4.0.3` release needed by Astro's language tooling is excepted from the provenance chronology rule after inspecting its 2024 release date and registry signature metadata. This exception does not disable integrity checks or authorize scripts. Reselect is overridden to 5.3.0 instead of using Recharts' older provenance-regressing resolution. TypeScript stays on 6.x because Astro's current checker declares support only for 5.x/6.x. These are intentional compatibility choices; reassess on upgrades.

## Locale and calculator state

English uses the existing routes; Spanish pages live under `/es`. Spanish page entry points reuse the same Astro pages. Shared middleware translates static markup at render time, including metadata and structured data, while leaving React islands and executable scripts intact. Islands receive an explicit locale and render translated content themselves so hydration matches. Both versions have canonical and alternate-language links and localized share images.

Each calculator uses a separate versioned Zustand persist key in localStorage. Only input drafts and view preferences are stored; outputs are recalculated. Client hydration runs after the initial render. Malformed saved shapes revert to defaults, storage failures leave controls usable, and reset replaces only the active tool’s draft. Locale changes preserve the same tool state. Persistence is local to this browser and origin, with no server sync.

Vite uses separate development and production-build cache directories. This prevents a build from invalidating optimized dependencies used by a running dev server. Workspace source packages are explicitly bundled through Vite’s `ssr.noExternal`.
