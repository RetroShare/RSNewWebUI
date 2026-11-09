# AGENTS.md

Rules for any agent working in this repo. Not suggestions.

## Design

- Keep the existing design system in mind at all times when working on UI/UX.
- No arbitrary values. Use an existing design token, or add a new token and use
  that. Never a raw hex, px, or rem that bypasses the scale.
- On any UI/UX work, think about the user: QoL improvements, keep it simple for
  the common case, visual appeal, accessibility.
- Read `docs/design-system.md` before UI changes. Keep its color and component
  reference in sync when changing shared tokens or controls.
- Use semantic color tokens for both light and dark modes. Primary actions use
  `--action-*` and `--on-brand`, not text or surface tokens as substitutes.
- Reuse shared headers, search, menus, navigation, composers and dialogs. Keep
  the compact utility design; avoid new page-specific variants without a need.
- Keep desktop control heights on mobile. Let labels and layouts adapt instead
  of enlarging all buttons. Keep mobile input text readable.
- Use links for navigation and buttons for actions. Label icon-only controls,
  retain visible keyboard focus, and never communicate state by color alone.
- Keep overlays inside the visual viewport with scrollable content and reachable
  actions. Do not dismiss touch menus on focus loss before a tap completes.

## Code

- Before writing a function or util, check whether one already exists. Reuse it.
- Comment only when the code cannot explain itself, or to say WHY. Never to
  restate WHAT. Use extremely simple english, simple enough for a toddler.
  Max 4 lines. Longer than that, break it into bullets or a JSDoc block
  (JSDoc preferred).
- Do what was asked. Nothing else.
- Stuck on the same thing twice? Stop and ask. Do not keep retrying variations.

## Process

- Read files with the Read tool. No `ls`/`wc`/`grep` recon before reading a file
  that is about to be read anyway.
- Commit only when told to in that message. Never push without an explicit yes.
- No self-references, no AI attribution, no filler comments in code, commit
  messages, or PR descriptions.
- Concision over grammar. Fragments are fine.
- No narration. Ship the code, then a few lines on what changed.
- Commit messages use `feat:`, `fix:`, `chore:` or `docs:` followed by details.
- Run `npm run lint` and `npm run build` from `webui-src/`. Rebuild and include
  tracked generated CSS/icons with their source changes; never edit them by hand.
- Check changed screens in light/dark modes and narrow/wide layouts. Distinguish
  browser fixtures from live Core validation; do not claim checks not performed.
