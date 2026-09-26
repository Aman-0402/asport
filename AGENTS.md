# AGENTS.md

Guidance for AI agents (and humans) working in this repo.

## Project

Multi-page portfolio for **Astha Shukla** (BBA Marketing student, Allenhouse Business School, Kanpur).
Being rebuilt from a plain static site into a **3D, scroll-driven, multi-page site**.

- **Audience:** recruiters, internship leads, faculty.
- **Design read:** cinematic, dark-first portfolio with a warm coral accent carried over from the original brand. 3D objects react to scroll and pointer; content stays readable and fast.
- **Dials:** variance 8, motion 8, density 3 (design-taste skill scale).

## Stack

| Concern | Choice |
|---|---|
| Build | Vite (multi-page app, one HTML entry per page) |
| 3D | Three.js (single shared WebGL canvas, per-page scene modules) |
| Scroll animation | GSAP + ScrollTrigger |
| Smooth scroll | Lenis (driven by GSAP ticker) |
| Page transitions | Cross-document View Transitions API + GSAP overlay fallback |
| Fonts | Self-hosted via `@fontsource-variable/*` (no font CDN) |
| Language | Vanilla ES modules, no UI framework |
| Deploy | GitHub Pages via GitHub Actions (`dist/`) |

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # Production build to dist/
npm run preview   # Serve dist/ locally
```

## Structure (target)

```
/
├── index.html  about.html  skills.html  projects.html  certifications.html  contact.html
├── partials/              nav.html, footer.html, head.html (injected at build by vite.config.js)
├── public/                static assets copied as-is (photo, certificate, favicon, robots.txt, sitemap.xml)
├── src/
│   ├── main.js            entry for every page: boots scroll, 3D, transitions, UI, then page module
│   ├── core/              lenis + gsap setup, theme, nav, reduced-motion + WebGL capability checks
│   ├── three/             renderer singleton, shared materials/palette, scenes/<page>.js
│   ├── pages/             per-page scroll choreography (<page>.js), selected by body[data-page]
│   ├── ui/                reusable behaviors (split text, magnetic buttons, counters, tilt, filter)
│   └── styles/            tokens.css, base.css, layout.css, components.css, pages/<page>.css
├── .github/workflows/     deploy.yml (Pages)
└── web-dev-skills/        reference material only, gitignored, never shipped
```

## Conventions

- **Partials:** nav/footer/head markup lives once in `partials/` and is injected with `<!-- @include name -->` via the custom plugin in `vite.config.js`. Never duplicate nav/footer into pages.
- **Page identity:** `<body data-page="...">` selects the page module in `src/pages/` and the 3D scene in `src/three/scenes/`, and drives the active nav link.
- **One WebGL canvas** (`#webgl`, fixed, behind content). Scenes are lazy-imported per page so Three.js code for other pages is never loaded.
- **Styling:** CSS only, no inline `<style>` blocks, no inline `style=""` except values set by JS animation. Tokens in `src/styles/tokens.css` (OKLCH). Dark is default; light theme via `[data-theme="light"]`. Preference stored in `localStorage` key `astha-theme`.
- **Accent lock:** coral is the only UI accent. Mint appears only as a lighting tint inside 3D scenes.
- **Radius system:** buttons/tags full-pill, cards and media 14px, nothing larger.
- **Motion rules:** animate `transform`/`opacity` (and shader uniforms) only. UI transitions under 300ms with `cubic-bezier(0.23, 1, 0.32, 1)`. Scroll-scrubbed motion may be longer.
- **Reduced motion is mandatory:** `prefers-reduced-motion: reduce` disables Lenis, scrubbed 3D camera moves, and split-text; content must render fully visible with no animation.
- **No-WebGL fallback:** if WebGL is unavailable, skip Three.js entirely and show the CSS gradient backdrop. No page may depend on the canvas for content.
- **Performance budget:** device pixel ratio capped at 2 (1.5 on mobile), ~30fps on mobile/low-power, pause render loop when tab hidden, dispose scene on page leave, engine loads after `load` + idle with `compileAsync`, software WebGL treated as no WebGL (`?webgl=force` to override). Target Lighthouse Performance >= 85 on mobile.
- **Copy rules:** no em dashes or en dashes anywhere (use commas, colons, hyphens). No buzzwords. No invented stats: only numbers from the resume.
- **Contact privacy:** phone number is intentionally hidden. Do not add `tel:` links or phone copy unless the user asks.
- **SEO:** unique `<title>` and meta description per page, one `h1` per page, JSON-LD `Person` on home, canonical URLs, `sitemap.xml`, `robots.txt`, descriptive alt text.

## Interactive hero character

`src/components/InteractiveCharacter/InteractiveCharacter.js` (+ `.css`), mounted from `src/pages/home.js` into `[data-interactive-character]`.

- One `<canvas>`, one frame drawn at a time; frames preloaded as `Image` objects (frame 1 first, direction frames next, rest in the background).
- All tuning lives at the top of the file: `DIRECTION_FRAMES`, `TRACKING` (dead zone and sensitivity per device class), `MOTION` (smoothing, max step, loop), `FACE_ORIGIN`.
- Phones, touch-only devices at phone width, and reduced motion get frame 1 only, with no listeners and no preload.
- The home 3D blob is hidden in the hero station so it does not compete with the blob baked into the frames.

## Content source

All copy comes from Astha Shukla's resume/profile (see git history of the original static pages and `profile-readme.md`). Facts to keep exact:

- BBA Marketing, Allenhouse Business School, Kanpur, 2025 to present
- Class XII 86%, Class X 80%, K.R. Education Centre
- Agentic AI Certified Foundations Associate, Oracle University (Oracle Certified), September 18, 2026
- Digital Marketing certification, HubSpot Academy
- Projects: Consumer Preference & Online Shopping Research; Marketing & Business Presentations
- Email: aasthashuklaastha44@gmail.com, based in Kanpur, Uttar Pradesh

## Git workflow

- Work on `main`, one commit (or small set) per phase, then `git push origin main`.
- **No `Co-Authored-By` or other attribution trailers in commit messages.**
- Conventional commit subjects, e.g. `feat(phase-2): three.js engine with scroll-driven camera`.

## Phase plan

Status legend: `[ ]` todo, `[x]` done.

### Phase 0: Plan and guardrails
- [x] Audit existing site (6 pages, `styles.css`, `main.js`, assets)
- [x] Rewrite AGENTS.md with stack, conventions, phase plan
- [x] Gitignore `web-dev-skills/`, `node_modules/`, `dist/`

### Phase 1: Vite foundation and design system
- [x] `package.json`, Vite MPA config with 6 entries and partial-include plugin
- [x] Move assets to `public/` (rename certificate to a URL-safe filename)
- [x] New token system (OKLCH, dark default + light), self-hosted fonts, base/layout/components CSS
- [x] Shared nav (with mobile menu, theme toggle) and footer as partials
- [x] Port all six pages' content into the new markup skeleton (no 3D yet), remove old `styles.css`/`main.js`
- [x] Build passes

### Phase 2: Motion and 3D engine
- [x] Lenis smooth scroll synced to GSAP ticker + ScrollTrigger
- [x] Three.js renderer singleton, resize, DPR cap, visibility pause, dispose
- [x] Capability checks: reduced motion, WebGL, low-power heuristics
- [x] Scene contract: `create({ renderer, scroll }) -> { update(t), onScroll(p), dispose() }`
- [x] Shared UI motion: split-text reveals, magnetic buttons, scroll reveals, counters

### Phase 3: Home page experience
- [x] Hero 3D scene: floating coral/mint sculptural forms, pointer parallax, scroll-driven camera dolly
- [x] Pinned scroll story sections (who I am, what I work on, featured work teaser)
- [x] Horizontal marquee of focus areas, CTA to projects/contact

### Phase 4: Inner pages, 3D per page
- [x] About: scroll-drawn 3D path through education timeline
- [x] Skills: 3D sphere of skill labels (CSS-projected DOM text) in a sticky column, highlighting the group in view
- [x] Projects: sticky stacked case panels that tilt in from 3D and recede under the next, with filter
- [x] Certifications: 3D certificate plane that turns in on scroll, animated counters
- [x] Contact: pointer-following blob, large email CTA with copy-to-clipboard

### Phase 5: Transitions and polish
- [x] Cross-page transitions (View Transitions API, overlay fallback)
- [x] Preloader tied to font + scene readiness (short, skippable)
- [x] All interaction states (hover, focus-visible, active) audited
- [x] Light theme pass on every page, 3D palette follows theme

### Phase 6: SEO, performance, deploy
- [x] Meta, Open Graph, JSON-LD, canonical, sitemap.xml, robots.txt, favicon
- [x] Image optimization, lazy loading, code-split check
- [x] GitHub Actions workflow to deploy `dist/` to GitHub Pages
- [ ] Enable Pages in repo settings (Source: GitHub Actions); owner action
- [x] Final design-taste pre-flight + README update
