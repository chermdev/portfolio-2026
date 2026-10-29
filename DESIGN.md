# chermdev design system

This is Charlie’s (chermdev) personal site: who he is, what he builds, and free tools that run in the browser. It should read like a developer’s workbench: precise, calm, and specific. Every page should make clear in seconds who made it and what is here. Prefer concrete statements (a role, a stack, a real repo) over slogans.

## Source of truth

- `packages/ui/src/styles.css` owns all visual tokens and shared compositions.
- `packages/ui/src/components/` owns the installed shadcn primitives. Import through `@portfolio/ui/components/*`.
- `/system-design` is the live component reference. Add or update its examples whenever a reusable visual pattern changes.
- Application pages compose these foundations using Tailwind. Do not add local color literals, arbitrary spacing, page-level style blocks, or duplicated CSS. If a value is missing, add a named token or a shared variant first.
- Dynamic data visualization geometry, animation transforms, and shadcn positioning variables are the exceptions: those values describe runtime geometry, not page styling.

## Art direction

Palette: white `#ffffff`, ink `#171717`, neutral surfaces `#f5f5f5`, lilac `#e9e5f1`. Dark backgrounds use near-black `#090909` with neutral charcoal surfaces. Dark mode remaps semantic roles in the same token file. Never use separate page-specific dark palettes.

Manrope is the self-hosted variable typeface. Display text uses the shared fluid scale, medium weight, and deliberate line breaks. Body text has comfortable leading and stays under 68 characters where practical. Metadata (paths, stacks, categories, status, section labels) uses `.meta`: the system monospace stack, small and muted. It is the workbench accent; do not use it for body copy. Labels use sentence case; no decorative numbering or repeated uppercase eyebrows.

Layout concept:

```text
desktop: [ identity     navigation     theme / contact ]
         [ who I am / actions      on-this-site index  ]
         [ about: heading + focus areas   story        ]
         [ selected projects (screenshot cards)        ]
         [ tools intro            tools by category    ]
         [ contact                                     ]
mobile:  [ identity                         menu/theme ]
         [ who I am / actions                         ]
         [ on-this-site index                         ]
         [ about / projects / tools / contact, stacked ]
```

All content aligns to `.page-shell`. Section spacing uses `.section`, `py-section`, or `pt-section`. The global max width, gutters, text scales, and radius are CSS variables exposed through Tailwind. Tailwind's shared spacing scale handles gaps, padding, and margins; do not invent per-page pixel values. Inner page headers (`/tools`, `/projects`, tool pages) start with `pt-12 pb-section`; `.section` spacing is for the sections below them. The chrome torus knot still (`/sculpture.png`) is only the OG image mark. Avoid decorative gradients and motion.

## Components

- Compose shadcn components before building a new control. Prefer variants over class overrides; `className` should mainly place a component in the layout.
- Forms use FieldGroup, Field, FieldLabel, FieldDescription, and FieldError. Labels must be associated with their controls. Show invalid input beside the field and suppress invalid results.
- Small option sets use ToggleGroup. Select items belong inside SelectGroup. Dialog, Sheet, and Drawer require an accessible title.
- Use semantic tokens such as `bg-background`, `text-muted-foreground`, and `border-input`. Colors come from tokens, including errors, charts, and focus.
- Keep the outer radius equal to inner radius plus padding for nested surfaces. Use borders for structure and restrained shadows for elevation.
- Use Lucide consistently, with a 1.5 stroke beside regular text and 2 beside semibold text. Interactive icon controls require labels. Use Lucide components for all interface icons, including link arrows and playback controls; do not substitute Unicode glyphs or hand-drawn SVGs. Keyboard key labels and the brand mark are not interface icons.
- Astro pages must render anchors with `buttonVariants()`; React `asChild` does not forward props through Astro's static slot wrappers. React islands can use Button with `asChild` normally.
- The full available official shadcn catalog is installed. The upstream `questionnaire` item was missing from `new-york-v4` at setup; record its state in the gallery rather than impersonating an upstream component.

## Motion and accessibility

- Page content renders without entrance animation. Keep ordinary controls instant or within 150ms.
- CSS transitions name exact properties. Never use `transition-all`.
- Press feedback is `scale(0.96)` with a 150ms ease-out transition. Use Button's `static` prop where movement distracts.
- Theme icons crossfade between opacity 0/1, scale 0.25/1, and blur 4px/0 using `cubic-bezier(0.2, 0, 0, 1)`. Suppress page transitions during the theme swap.
- Respect reduced motion; stop any motion if the preference changes.
- Preserve visible focus, keyboard operation, logical heading order, and 44px primary touch targets. Do not animate keyboard-initiated feedback.
- Test desktop and narrow mobile in both themes. No horizontal page overflow; scrollable data tables are allowed.

## Content and sharing

Keep interface copy direct and specific. Do not invent client projects, testimonials, performance metrics, biography, or contact details. Public identity is “Charlie” / chermdev; do not publish his full name, employer, or city. GitHub and LinkedIn are the confirmed public contacts. Projects are the ones he lists, including client websites he chose to show; describe what each site does, not the client’s location. Websites and apps get a desktop screenshot in `apps/web/src/assets/projects` (1440×900, captured after load animations finish); repositories without an interface stay as rows. Planned tools may be listed as “Coming soon” and must move to the real tool list when they ship.

Calculators must show editable assumptions, source dates, formula explanations, and limitations. Money uses tabular figures. Loan totals agree with the downloadable schedule. Never animate calculated numbers.

Open Graph source lives in `apps/web/scripts/generate-og.mjs`, with outputs in `apps/web/public/og`. Run `pnpm og` to regenerate. Use the same Manrope font, palette, and actual sculpture still; inspect both 1200×630 and 400×210. Every indexable page gets canonical, description, large Twitter card, and an absolute OG image URL.

## Change verification

Run `pnpm check`, `pnpm test`, and `pnpm build`. For UI changes, inspect the relevant `/system-design` states and changed page at mobile/desktop sizes, light/dark, and reduced motion. Financial formula changes need independent domain review. Record meaningful limitations; do not claim visual coverage based only on a build.

## Languages and saved inputs

English lives at the root routes; Spanish uses `/es`. Use `@portfolio/i18n` translations for public copy, including labels, validation, metadata and downloads. Static Astro HTML is translated at render time by the shared middleware; React islands receive the locale explicitly and use the same catalog. Never translate React DOM nodes after hydration. Preserve the locale on internal links. Component API names stay in their original form.

Calculator drafts use independent versioned Zustand persist stores. Persist only inputs and view preferences, not computed results. Hydrate after the first client render to match server markup. Reset only the active calculator; keep language and theme unchanged.
