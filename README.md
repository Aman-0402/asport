# Astha Shukla | Portfolio

A six-page portfolio for Astha Shukla, BBA Marketing student at Allenhouse Business School, Kanpur. It uses 3D graphics and scroll-driven animation: a WebGL scene moves with the page, and each page has its own scroll effects.

## Pages

| Page | What happens |
| --- | --- |
| `index.html` | Noise-shaped 3D blob that moves between sections as you scroll and changes shape for each focus area. Also: a statement whose words light up as you scroll, and a tools marquee that speeds up with scroll speed |
| `about.html` | Education timeline whose line fills as you scroll, strengths that light up in order, portrait parallax |
| `skills.html` | 3D sphere of skill labels that sticks beside the lists and highlights the group in view |
| `projects.html` | Stacked case studies that tilt in from 3D and shrink back under the next one, with a filter |
| `certifications.html` | Certificate swings in from a 3D angle and settles flat, numbers count up |
| `contact.html` | Blob that leans toward the pointer, large email link with a copy button |

Pages change with cross-document View Transitions. Browsers without them get a coral curtain wipe instead.

## Tech

- **Vite** multi-page build. Shared head, nav, and footer are HTML partials injected at build time.
- **Three.js**: one fixed canvas, custom GLSL shaders (simplex-noise displacement with a fresnel rim), and a separate scene module for each page, loaded only when needed.
- **GSAP + ScrollTrigger** for scroll animation, and **Lenis** for smooth scrolling on the same ticker.
- Self-hosted variable fonts: Bricolage Grotesque (display) and Manrope (body).
- OKLCH design tokens, dark by default with a light theme.

## Accessibility and performance

- `prefers-reduced-motion` turns off smooth scroll, split text, scrubbed motion, and animated 3D. All content stays visible.
- Devices with software-only WebGL, or no WebGL at all, get a CSS gradient backdrop instead of the 3D scene.
- Three.js loads after first paint and compiles its shaders asynchronously. On phones it renders at about 30fps with a capped pixel ratio.
- Lighthouse (mobile): Accessibility 100, SEO 100, Best Practices 100, Performance 85 to 91.

## Develop

```bash
npm install
npm run dev       # dev server on port 5173
npm run build     # outputs dist/
npm run preview   # serve dist/
```

To test 3D on a machine without GPU acceleration, add `?webgl=force` to the URL.

## Deploy

`.github/workflows/deploy.yml` builds the site and publishes `dist/` to GitHub Pages on every push to `main`. In the repo, go to **Settings > Pages > Source** and choose **GitHub Actions** once.

See [AGENTS.md](./AGENTS.md) for conventions and the build plan.

## Contact

- Email: aasthashuklaastha44@gmail.com
- Based in Kanpur, Uttar Pradesh
