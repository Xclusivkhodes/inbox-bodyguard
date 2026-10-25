# READY: Inbox Bodyguard design package
Completed Sun 25 Oct 2026, 22:28 GMT (Africa/Accra).

## What's here
- NAME.md: name check (keep it), usage, taglines
- BRAND.md: palette + WCAG contrast, type, space, motion, voice, components, the "which model did what" pattern, engineer handoff and state specs
- LICENSES.md: fonts, icons, tools (all OFL, ISC, MIT or Apache)
- tokens.css / tokens.json / tailwind.config.js / components.css: the design system
- logo/: mark (light, dark, mono), lockups, wordmarks, app icon (SVG + 512/180 PNG), favicon (SVG, ICO, 16/32/48 PNG)
- html/: reference screens. Open html/index.html. Add ?theme=dark to any app screen, or ?state=blocked on landing
- mockups/: 00-presentation-board.png plus each screen at 1440x900 @2x and two mobile screens at 390x844 @2x
- _src/: generators (build_tokens.py, build_logo.py, build_html.py, contrast.py), page sources and partials, board source

## Rebuild
    python3 _src/build_tokens.py && python3 _src/build_logo.py && python3 _src/build_html.py
    cd ../_render && bash render_all.sh
    node shot.js ../inbox-bodyguard/_src/board/board.html ../inbox-bodyguard/mockups/00-presentation-board.png 2400 1700 2
(The renderer uses playwright-core in design/_render and system Chrome at /usr/bin/google-chrome.)
