# READY v1.1: Inbox Bodyguard (neutral light/dark, follows the system)
Finished Sun 25 Oct 2026 (Africa/Accra, GMT).

- **Drop-in files:** tokens.css, tokens.json, tailwind.config.js, components.css. All names are unchanged and only values changed. One class was added: `.ib-theme-toggle`. See CHANGELOG.md. The v1.0 copies are in v1.0-backup/.
- **Palette, modes and contrast:** BRAND.md §2. All 62 text pairs pass AA in both modes (lowest 5.10), and the UI pairs pass 3:1.
- **Theme:** follows `prefers-color-scheme`. `data-theme="light|dark"` or `class="dark"` overrides it, and the toggle persists the choice in `localStorage('ib-theme')`. Tested: clicking the toggle flips the theme in both OS modes, and the choice survives a reload.
- **Board:** mockups/00-presentation-board.png (2400x2140 @2x).
- **Key screens:** each light screen has a dark twin (`b` suffix, rendered with OS dark):
  - 01 / 01b landing
  - 04 / 04b guard result
  - 05 / 05b evidence
  - 03 / 03b inbox
  - 07 / 07b mobile landing
  - 08 / 08b mobile guard
  - light only: 02 onboarding, 06 components, 09 index
- **Rebuild:** run `python3 _src/build_tokens.py`, then `python3 _src/build_html.py`, then `python3 _src/contrast.py`, then `bash ../_render/render_all.sh`. Then render the board with `node ../_render/shot.js _src/board/board.html mockups/00-presentation-board.png 2400 2140 2`.
