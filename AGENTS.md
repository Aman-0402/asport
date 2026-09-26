# AGENTS.md

Guidance for AI agents (and humans) working in this repo.

## Project

Static multi-page portfolio site for Astha Shukla (BBA Marketing student). Plain HTML/CSS/JS — no framework, no build step, no backend.

Current design direction: modern marketing portfolio with a fixed glass-style navbar, light/dark theme toggle, responsive hero, card-based sections, SVG-style skill/contact icons, and a visible HubSpot certificate.

## Structure

```
/
├── index.html            Home (hero, typing effect, quick highlights)
├── about.html            Summary, education, strengths, languages/interests
├── skills.html           Marketing / Professional / Digital skill cards
├── projects.html         Academic projects, filterable by category
├── certifications.html   Certifications, achievements, animated counters
├── contact.html          Static contact info (mailto:, no form)
├── styles.css            Single stylesheet, CSS custom properties for theme
├── main.js               Single vanilla JS file, all interactivity
├── photo.jpeg            Profile image used across hero/about/contact
├── Digital Marketing Certified by HubSpot Academy.png
├── profile-readme.md     Animated GitHub/profile README content
└── README.md
```

Flat structure by design — no `css/`/`js/` subfolders. Keep new assets at root unless the user asks otherwise.

## Conventions

- **No inline `<style>` blocks** in HTML — keep new styling in `styles.css`.
- **No JS frameworks/libraries.** Vanilla JS only, no jQuery, no build tools.
- **Theme tokens** live in `:root` in `styles.css` (`--color-*`, `--font-*`, `--space-*`, `--shadow-*`). Dark theme overrides live in `[data-theme="dark"]`. Change colors through tokens whenever possible.
- **Navbar/footer markup is duplicated per page** (no templating engine). When editing nav links, theme toggle markup, or footer text, update all 6 HTML files identically.
- **Navbar is fixed**, not just sticky. `body` uses `padding-top: var(--navbar-height)` so content clears the header.
- **Active nav link** is driven by `data-page` attribute on `<body>` matching `data-page` on the matching `<nav>` `<a>` — set in `main.js` (`initActiveNavLink`).
- **Light/dark theme** is driven by `initThemeToggle` in `main.js`. The user preference is stored in `localStorage` under `astha-theme`.
- **New page checklist**: copy an existing page's `<head>`, navbar, and footer verbatim; set a unique `data-page` value on `<body>` and add a matching nav link (with the same `data-page`) to all other pages.
- **Fonts**: Google Fonts CDN (Plus Jakarta Sans for headings, Manrope for body) — loaded per-page in `<head>`.
- **CSS reset**: `normalize.css` via cdnjs CDN, loaded before `styles.css`.
- **Skill icons** are CSS mask icons using inline SVG data URIs in `styles.css`. Prefer adding new `icon-*` classes there instead of introducing image files for small UI icons.
- **Contact privacy**: phone number is intentionally hidden for now. Do not re-add `tel:` or phone copy unless the user explicitly requests it.

## Content source

All copy (summary, education, skills, projects, achievements, certificate info, contact info) is sourced from Astha Shukla's resume/profile material. If the resume changes, update the corresponding page(s) directly — there is no CMS or data file.

## Running locally

No build step. Open `index.html` directly in a browser, or serve the folder with any static server (e.g. VS Code Live Server) so relative paths resolve consistently.

## Interactive features (main.js)

- Mobile hamburger nav toggle
- Light/dark theme toggle with persisted preference
- Active nav link highlighting
- Scroll-reveal animations (`IntersectionObserver`, `[data-aos]` attributes)
- Hero typing effect (`.hero-typed`, phrases via `data-phrases` JSON attribute)
- Animated counters (`.counter-number`, target via `data-target`)
- Project filter tabs (`.filter-tab` + `.project-card[data-category]`)

Each feature guards on the relevant element existing, so `main.js` is safe to include unchanged on every page.

## Visual notes

- Keep the wider `--container-width: 1400px`, but avoid oversized hero text/images that crowd the first viewport.
- Cards use `--radius-sm` / `--radius-md`; avoid adding very round nested card layouts.
- Dark mode needs explicit contrast checks for cards and labels. Add `[data-theme="dark"]` overrides when a light gradient or muted label becomes low contrast.
- Certificate image should remain visible on `certifications.html`.
- `profile-readme.md` uses external badge/header SVG services for GitHub-style animation; site pages themselves should stay dependency-light.
