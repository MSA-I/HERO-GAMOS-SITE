# hero-lab — GAMOS Hero (sandbox)

A standalone preview of a **new GAMOS hero** that faithfully clones the **FIND
Real Estate** layered-pinned-scroll effect (source project:
`D:/משה פרוייקטים/findrealestate-clone`, dissected in its `איך-ההירו-בנוי.md`),
re-skinned with **GAMOS assets + Hebrew copy only**. Nothing here is wired into
the production site — it is fully isolated.

Preview: serve the repo root and open **`/`**.

```bash
# from this repo folder
python -m http.server 8000
# then visit http://localhost:8000/

# or with Node
npx serve . -p 8000
```

## What it is — the FIND recipe, faithfully

A 100vh sticky stage pinned across a **500vh** scroll track
(`.hero_root { height:500vh; margin-bottom:-100vh }`, `.hero_top { sticky }` —
identical to FIND), composed of 8 absolutely-stacked layers:

| z | layer (ours) | FIND analogue | source | scroll motion |
|---|--------------|---------------|--------|----------------|
| 1 | sky | `hero_back` | `assets/sky.webp` | gentle scale |
| 2 | subject (rising cut-out ridge) | `hero_house` | `assets/subject.webp` | `y:-40% scale:1.3` |
| 3 | **subject masked through the `GAMOS / EVENTS` letters** | `hero_composite` | same `subject.webp` via inline **SVG `<mask>`** | `opacity 0→1` (fills) |
| 4 | **two distinct clouds** spreading to the sides | `hero_clouds` | `cloud-left.webp` + `cloud-right.webp` | `x:±15%` |
| 5 | outline wordmark (hollow stroke, fades as fill rises) | `hero_logo` | inline SVG `<text>` | `opacity 1→0.15` |
| 6 | rising smoke band | `hero_smoke` | `assets/smoke.webp` | `translateY 70%→up` |
| 7 | cream veil dissolving into the next section | `hero_overlay` | CSS gradient | fade to ivory |
| 8 | content: eyebrow + headline + sub + two CTAs | `hero_content` | Hebrew copy | fade/lift |

**The masked wordmark is a SECOND copy of the subject seen only through the
`GAMOS / EVENTS` letters** (Cinzel) via an inline SVG `<mask>` — exactly FIND's
"image-through-letters" trick, but original to GAMOS. The same `<text>` geometry
feeds both the mask (L3) and the hollow outline (L5), so they register perfectly
with no drift.

### Faithfulness vs. the previous sandbox (the 3 deviations fixed)

1. **Mask** — was `background-clip:text` on live Cinzel text (soft/typographic);
   now an **SVG image-mask on a doubled subject copy** (crisp/graphic), like FIND.
2. **Subject** — there was no rising cut-out; now a real cut-out **ridge** rises
   and grows and fills the letters (FIND `hero_house`).
3. **Clouds/smoke** — one band was reused 3×; now **two genuinely different
   cloud cut-outs** + a separate smoke band.

## Assets (all local to this sandbox)

Current asset choices:

- `sky.webp` / `sky-mobile.webp` — final supplied warm back-sky image, exported
  from the uploaded JPEG into optimized WebP sizes.
- `subject.webp` / `subject-mobile.webp` — the rising transparent desert layer,
  generated from `GAMOS-DOCS/תמונות לאנימציית האתר/HERO/מדבר-2.png`. The source
  is RGBA and already carries a real transparent background.
- `cloud-left.webp` + `cloud-right.webp` — the original supplied FIND cloud
  image, exported twice for the existing left/right layer wiring. The right side
  is mirrored in CSS.
- `smoke.webp` — the original supplied FIND smoke image with alpha.

### Note on `@imgly/background-removal-node`

The plan called for a background-removal step (the `מחולצות/אולם|ריזורט` frames
are fully opaque AND segment poorly — verified empirically). The dependency was
installed **with explicit user approval** (it lives in the shared `package.json`
`devDependencies`). In the end the user chose the **desert ridge** subject, which
already has clean alpha, so the build does **not** invoke bg-removal — but the
dependency remains available for a future opaque-structure subject.

## Vendor (self-hosted in `assets/vendor/`)

- `gsap.min.js` + `ScrollTrigger.min.js` — copied from the site's `/assets/vendor/`.
- `lenis.min.js` + `lenis.css` — **Lenis 1.3.23** (UMD global), per the approved plan.

## Animation / JS

`js/hero-lab.js` keeps a **single** ScrollTrigger that writes one `--p` (0→1)
variable; every layer derives its motion from `--p` via CSS `calc()`. A separate
entrance timeline tweens `--enter` (0→1) on load.

The content text now mirrors FIND's text entrance pattern:

- the headline is split into word wrappers (`.word-reveal` / `.word-reveal__inner`);
- each word animates from `y:"115%"` to `y:"0%"` with `stagger` and `power4.out`;
- eyebrow, sub-copy and CTAs animate with fade + `y:70 → 0` using `expo.out`;
- text typography uses FIND's self-hosted **Instrument Sans** and **Lora** files
  from `assets/fonts/find/`, with Hebrew-safe local fallbacks.

Lenis feeds ScrollTrigger. `document.fonts.ready` triggers `ScrollTrigger.refresh()` — the SVG
`<text>` mask + outline are geometry-load-bearing on Cinzel.

## Fallbacks (avoid FIND's white-screen bug)

FIND shipped `visibility:hidden` removed only after React hydration — when route
files were missing, hydration failed → **white screen**. This port is **always
visible**: there is no JS-only hidden state.

- **No JS** (`html.no-js`): the 500vh track collapses to a finished 100vh frame —
  filled letters, faint outline, subject + clouds + smoke settled. Never blank.
- **`prefers-reduced-motion: reduce`**: layered look kept, scrub + idle loops off,
  scene renders at a settled mid-state (letters filled) and simply scrolls away.
- **Vendor missing / init error**: `hero-lab.js` forces `--enter:1` and bails.

## QA

`node hero-lab/scripts/qa-hero-lab.mjs` (after starting the server) runs a
Playwright matrix (desktop 1440 scrub p=0/.25/.5/.75/1, mobile 390, reduced-motion,
no-js) and writes screenshots to `hero-lab/scripts/__shots__/`. Playwright is
resolved from the npx cache via `createRequire` — it does **not** touch
`package.json`.

```bash
npx serve . -p 8000 &
node hero-lab/scripts/qa-hero-lab.mjs    # 10/10 PASS expected
```

## ⚠️ Governance note before promoting to production

The project Constitution **§2 currently forbids Lenis** (removed 2026-06-10) and
governs the hero. This sandbox uses Lenis + the FIND structure as an approved
**preview-only** exception. **Before** this hero replaces the real one, you must:
1. amend §2 to re-allow + self-host Lenis (and add a §12 Maintenance Log row), or
   swap Lenis for native scroll (the JS already degrades cleanly without it); and
2. reconcile `@imgly/background-removal-node` (keep as a build-time devDep or drop
   it, since the shipped build doesn't call it).

Promotion is a separate, explicitly-approved step — this folder changes nothing
in `index.html`, `css/`, `js/`, or the main `assets/`.
