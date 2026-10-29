# Working here

- Read the task, relevant code, and `DESIGN.md` first. Follow the design system.
- Use pnpm from the workspace root. Keep the single lockfile and pinned package-manager version.
- Apps live in `apps/`; shared UI and calculator logic live in `packages/`. Keep app-specific code out of shared packages.
- Use Tailwind tokens and installed shadcn components. Add reusable styles to `packages/ui`, then show them on `/system-design`.
- Implement bounded requests directly. Preserve existing work, use one writer per boundary, and avoid unnecessary workflow overhead.
- Reuse running servers. Never bypass authentication for testing. The admin shell has no backend or enabled admin actions.
- Test changed behavior with `pnpm check`, `pnpm test`, and `pnpm build`; use browser checks for UI. Financial logic changes need independent review.
- Keep fee assumptions editable and source-dated. Never silently reinterpret currency as account country or invent live rates.
- Use conventional commits, such as `feat(tools): add mortgage calculator`. Do not commit or push unless asked.
- Report the result, verification, and material limitations briefly.
