# Changelog: Inbox Bodyguard design system

## v1.1 (25 Oct 2026, Felix's feedback): neutral modes that follow the system
**No token or class was renamed or removed.** Only values changed, so `tokens.css`, `tokens.json`, `tailwind.config.js` and `components.css` can be swapped straight in. The v1.0 copies are in `v1.0-backup/`.

### What changed
- **Neutral backgrounds.** Light mode uses a white `#FFFFFF` page with zinc surfaces and borders. Dark mode uses a near-black `#111113` page with `#18181B` / `#1F1F22` surfaces and zinc borders. The cool, blue-leaning graphite and the jade-tinted selected row are gone. Jade and the lane colours (rose, amber, iris, sky) are kept for **accents only**.
- **The theme follows the OS.** tokens.css now has `@media (prefers-color-scheme: dark)`. `data-theme="light"` or `data-theme="dark"` on `<html>` overrides it, and `class="dark"` still works, as does `data-theme="system"`. A new `[data-theme="light"]` / `.light` block lets you force light even when the OS is dark, including on a subtree.
- **The landing page no longer defaults to dark.** `class="dark"` was removed from landing.html and board.html, so the landing follows the system. Its jade/iris radial glow and dot-grid background were removed, and the logo now swaps between light and dark versions.
- **A theme toggle on every screen.** The `.ib-theme-toggle` button and `ibToggleTheme()` were added in `_src/partials/head.html`. The choice is saved to `localStorage('ib-theme')`, and `?theme=light|dark` still works for previews. The button sits in the landing header, the app sidebar, the guard mobile topbar, onboarding, the index and the components page. theme-color metas were added for both modes.
- **Contrast.** It was re-checked for 62 text pairs and 7 UI pairs in both modes, and all pass AA. One fix: `model-memory` (light) went from Sky 600 to Sky 700, because it scored 4.40 on `model-memory-bg`.

### Token value changes
| Token | v1.0 | v1.1 |
|---|---|---|
| `--ink-25` | #FBFBFC | #FCFCFC |
| `--ink-50` | #F6F7F9 | #FAFAFA |
| `--ink-100` | #EEF0F3 | #F4F4F5 |
| `--ink-150` | #E5E8ED | #ECECEE |
| `--ink-200` | #D9DDE4 | #E4E4E7 |
| `--ink-300` | #BEC4CE | #D4D4D8 |
| `--ink-400` | #979EAB | #A1A1AA |
| `--ink-500` | #6E7684 | #71717A |
| `--ink-600` | #545B68 | #52525B |
| `--ink-700` | #3C424D | #3F3F46 |
| `--ink-800` | #2A2F37 | #27272A |
| `--ink-850` | #1F2329 | #1F1F22 |
| `--ink-900` | #16191E | #18181B |
| `--ink-950` | #0E1013 | #111113 |
| `--ink-1000` | #08090B | #09090B |
| `--bg` (light) | #F6F7F9 | #FFFFFF |
| `--bg` (dark) | #0E1013 | #111113 |
| `--bg-subtle` (light) | #EEF0F3 | #FAFAFA |
| `--bg-subtle` (dark) | #08090B | #09090B |
| `--surface` (dark) | #16191E | #18181B |
| `--surface-raised` (dark) | #1F2329 | #1F1F22 |
| `--surface-sunken` (light) | #F6F7F9 | #FAFAFA |
| `--surface-sunken` (dark) | #0E1013 | #09090B |
| `--surface-hover` (light) | #F6F7F9 | #FAFAFA |
| `--surface-hover` (dark) | #1B1E24 | #1C1C1F |
| `--surface-selected` (light) | #EEF6F3 | #F4F4F5 |
| `--surface-selected` (dark) | #14231F | #232326 |
| `--surface-inverse` (light) | #16191E | #18181B |
| `--surface-inverse` (dark) | #F6F7F9 | #FAFAFA |
| `--border` (light) | #E5E8ED | #E4E4E7 |
| `--border` (dark) | #2A2F37 | #27272A |
| `--border-strong` (light) | #D9DDE4 | #D4D4D8 |
| `--border-strong` (dark) | #3C424D | #3F3F46 |
| `--border-subtle` (light) | #EEF0F3 | #ECECEE |
| `--border-subtle` (dark) | #1C2026 | #1F1F22 |
| `--text` (light) | #16191E | #18181B |
| `--text` (dark) | #F6F7F9 | #FAFAFA |
| `--text-secondary` (light) | #545B68 | #52525B |
| `--text-secondary` (dark) | #BEC4CE | #D4D4D8 |
| `--text-tertiary` (light) | #646B78 | #67676F |
| `--text-tertiary` (dark) | #979EAB | #A1A1AA |
| `--text-disabled` (light) | #BEC4CE | #D4D4D8 |
| `--text-disabled` (dark) | #545B68 | #52525B |
| `--text-inverse` (dark) | #0E1013 | #111113 |
| `--accent-subtle` (dark) | #0F2A24 | #0E241F |
| `--on-accent` (dark) | #08090B | #09090B |
| `--action-sent` (light) | #545B68 | #52525B |
| `--action-sent` (dark) | #BEC4CE | #D4D4D8 |
| `--action-sent-bg` (light) | #EEF0F3 | #F4F4F5 |
| `--action-sent-bg` (dark) | #1F2329 | #1F1F22 |
| `--action-sent-border` (light) | #D9DDE4 | #E4E4E7 |
| `--action-sent-border` (dark) | #3C424D | #3F3F46 |
| `--model-memory` (light) | #1B72D4 | #185CAB |
| `--model-tool` (light) | #545B68 | #52525B |
| `--model-tool` (dark) | #BEC4CE | #D4D4D8 |
| `--model-tool-bg` (light) | #EEF0F3 | #F4F4F5 |
| `--model-tool-bg` (dark) | #1F2329 | #1F1F22 |
| `--shadow-xs` (light) | rgba(14,16,19,…) | rgba(9,9,11,…) |
| `--shadow-sm` (light) | rgba(14,16,19,…) | rgba(9,9,11,…) |
| `--shadow-md` (light) | rgba(14,16,19,…) | rgba(9,9,11,…) |
| `--shadow-lg` (light) | rgba(14,16,19,…) | rgba(9,9,11,…) |
| `--shadow-xl` (light) | rgba(14,16,19,…) | rgba(9,9,11,…) |

Dark-mode shadows are unchanged (they were already neutral black). `tokens.json` gains `"version": "1.1.0"` and a `"theme"` note.

### tailwind.config.js
- `darkMode` adds `'@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *):not(.light *) }'` alongside `.dark` and `[data-theme="dark"]`.

### components.css (class names unchanged)
- `.dark .ib-model-glyph` and `.dark .ib-step-node` now also match `[data-theme="dark"]` and OS dark.
- **New:** `.ib-theme-toggle` (a 32px bordered icon button) with `.ib-theme-moon` and `.ib-theme-sun`.

### Hardcoded values in the reference HTML
- In the landing "paper" email mock, the cool greys were swapped for zinc equivalents (`#EEF0F3→#F4F4F5`, `#6E7684→#71717A`, `#3C424D→#3F3F46`, `#16191E→#18181B`, `#E5E8ED→#E4E4E7`, `#545B68→#52525B`). The window-chrome dots now use `bg-border-strong`.
- The board is now a neutral light board (`#F4F4F5`) showing light and dark screens side by side, plus a Modes card.

### Build
- `_src/build_tokens.py` writes the new `@media` and override blocks.
- `_src/contrast.py` covers every surface × text pair, guard and action chips, and lanes on their `-bg`. It exits non-zero on any failure.
- `design/_render/render_all.sh` renders light and dark (`*b-*-dark`) shots. The dark shots use the OS setting, not `?theme`.

## v1.0 (25 Oct 2026)
Initial system.
