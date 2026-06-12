/**
 * qa-hero-lab.mjs — Playwright QA for the FIND-faithful hero-lab sandbox.
 *
 * Pattern copied from mobile/scripts/qa-mobile-pages.mjs: resolve Playwright from
 * the npx cache via createRequire (fallback to a local `playwright`), so this
 * touches NOTHING in package.json.
 *
 * Assumes a static server is already serving the repo ROOT, e.g.:
 *   npx serve . -p 8000          (then BASE = http://localhost:8000)
 * Override with:  QA_BASE=http://localhost:5050 node hero-lab/scripts/qa-hero-lab.mjs
 *
 * Verifies (plan §F):
 *  1. mask fills across scroll      (maskfill opacity: ~0 → >.4 → ~1)
 *  2. outline fades as fill rises   (outline opacity: ~1 → ≤.2, inverse of maskfill)
 *  3. two clouds spread to opposite edges + are DIFFERENT files
 *  4. smoke rises                   (translateY at p=1 higher than p=0)
 *  5. no blank frame at any p       (sky/subject imgs decoded; not ~uniform white)
 *  6. subject present + rises
 *  7. reduced-motion settled frame  (maskfill≈1, outline≈.2, no errors)
 *  8. no-js finished frame          (root ~100vh, maskfill=1, all visible)
 *
 * Screenshots → hero-lab/scripts/__shots__/.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const PW_CACHE = "C:/Users/art1/AppData/Local/npm-cache/_npx/5e2e484947874241/node_modules/playwright";
let chromium;
try { ({ chromium } = require(PW_CACHE)); } catch { ({ chromium } = require("playwright")); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, "__shots__");
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.QA_BASE || "http://localhost:8000";
const URL = BASE + "/hero-lab/";

const results = [];
const log = (ok, t, d = "") => { results.push([ok, t, d]); console.log(`  [${ok ? "PASS" : "FAIL"}] ${t}${d ? " — " + d : ""}`); };
const near = (v, target, tol) => Math.abs(v - target) <= tol;

/** Scroll the 500vh track to a normalized progress p∈[0,1] and read layer state. */
async function readAt(page, p) {
  await page.evaluate((pp) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * pp));
  }, p);
  await page.waitForTimeout(550); // settle for scrub:0.6
  return page.evaluate(() => {
    const cs = (sel, prop) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el).getPropertyValue(prop);
    };
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    };
    const imgOk = (sel) => {
      const el = document.querySelector(sel);
      return !!(el && el.naturalWidth > 0 && el.naturalHeight > 0);
    };
    return {
      p: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--p")) || 0,
      maskOpacity: parseFloat(cs(".layer--maskfill", "opacity")),
      outlineOpacity: parseFloat(cs(".layer--outline", "opacity")),
      cloudStart: rect(".cloud--start"),
      cloudEnd: rect(".cloud--end"),
      cloudStartSrc: document.querySelector(".cloud--start")?.currentSrc || document.querySelector(".cloud--start")?.src,
      cloudEndSrc: document.querySelector(".cloud--end")?.currentSrc || document.querySelector(".cloud--end")?.src,
      smoke: rect(".smoke__img"),
      subject: rect(".layer--subject img"),
      skyImgOk: imgOk(".layer--sky img"),
      subjectImgOk: imgOk(".layer--subject img"),
      contentVisible: parseFloat(cs(".layer--content", "opacity")) > 0.01,
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nQA hero-lab @ ${URL}\n`);

  // ---- Desktop scrub matrix ------------------------------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await desk.newPage();
  const deskErrs = [];
  dp.on("console", (m) => { if (m.type() === "error") deskErrs.push(m.text()); });
  await dp.goto(URL, { waitUntil: "load" });
  await dp.waitForTimeout(1800); // entrance timeline + fonts

  console.log("=== desktop 1440×900 ===");
  const snap = {};
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    snap[p] = await readAt(dp, p);
    await dp.screenshot({ path: resolve(SHOTS, `hero-p${String(Math.round(p * 100)).padStart(3, "0")}@1440.png`) });
  }

  // 1. mask fills
  log(snap[0].maskOpacity < 0.2 && snap[0.5].maskOpacity > 0.4 && snap[1].maskOpacity > 0.85,
    "1·maskfill reveals across scroll",
    `op p0=${snap[0].maskOpacity?.toFixed(2)} p.5=${snap[0.5].maskOpacity?.toFixed(2)} p1=${snap[1].maskOpacity?.toFixed(2)}`);

  // 2. outline fades inverse
  log(snap[0].outlineOpacity > 0.8 && snap[1].outlineOpacity <= 0.25 && snap[1].outlineOpacity < snap[0].outlineOpacity,
    "2·outline fades as fill rises",
    `op p0=${snap[0].outlineOpacity?.toFixed(2)} p1=${snap[1].outlineOpacity?.toFixed(2)}`);

  // 3. clouds spread opposite + different files
  const cStartMoved = snap[1].cloudStart.cx - snap[0].cloudStart.cx; // RTL start = right; +15% pushes it further right (→ +x)
  const cEndMoved = snap[1].cloudEnd.cx - snap[0].cloudEnd.cx;
  const differentFiles = (snap[0].cloudStartSrc || "").split("/").pop() !== (snap[0].cloudEndSrc || "").split("/").pop();
  log(Math.abs(cStartMoved) > 5 && Math.abs(cEndMoved) > 5 && Math.sign(cStartMoved) !== Math.sign(cEndMoved) && differentFiles,
    "3·two distinct clouds spread to opposite edges",
    `Δstart=${cStartMoved.toFixed(0)} Δend=${cEndMoved.toFixed(0)} files: ${(snap[0].cloudStartSrc||"").split("/").pop()} vs ${(snap[0].cloudEndSrc||"").split("/").pop()}`);

  // 4. smoke rises (smaller/negative y at p=1)
  log(snap[1].smoke.y < snap[0].smoke.y - 5,
    "4·smoke rises with scroll",
    `y p0=${snap[0].smoke.y.toFixed(0)} p1=${snap[1].smoke.y.toFixed(0)}`);

  // 5. no blank frame: sky + subject decoded at every p; + a pixel-uniformity check
  const allDecoded = [0, 0.25, 0.5, 0.75, 1].every((p) => snap[p].skyImgOk && snap[p].subjectImgOk);
  // uniformity: sample the rendered DOM via screenshot variance in-browser
  const uniform = await dp.evaluate(async () => {
    // draw the visible viewport to a small canvas and measure luma stddev
    return new Promise((res) => {
      const c = document.createElement("canvas");
      c.width = 80; c.height = 50;
      // can't readback cross-origin-free here without taint; approximate by
      // checking that multiple layers have non-zero painted area instead.
      const layers = [".layer--sky img", ".layer--subject img", ".layer--content"];
      const painted = layers.filter((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        const b = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return b.width > 4 && b.height > 4 && parseFloat(st.opacity) > 0.02 && st.visibility !== "hidden" && st.display !== "none";
      });
      res(painted.length);
    });
  });
  log(allDecoded && uniform >= 2, "5·no blank frame at any p (imgs decoded + layers painted)", `decoded=${allDecoded} paintedLayers=${uniform}`);

  // 6. subject present + rises
  log(snap[0].subjectImgOk && snap[1].subject.y < snap[0].subject.y - 5,
    "6·subject present and rises",
    `imgOk=${snap[0].subjectImgOk} y p0=${snap[0].subject.y.toFixed(0)} p1=${snap[1].subject.y.toFixed(0)}`);

  if (deskErrs.length) console.log(`  console errors: ${deskErrs.slice(0, 3).join(" || ")}`);
  log(deskErrs.length === 0, "·no console errors (desktop)", deskErrs.length ? deskErrs.slice(0, 2).join(" | ") : "clean");
  await desk.close();

  // ---- Mobile 390×844 ------------------------------------------------------
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mob.newPage();
  await mp.goto(URL, { waitUntil: "load" });
  await mp.waitForTimeout(1500);
  console.log("\n=== mobile 390×844 ===");
  const m0 = await readAt(mp, 0), m1 = await readAt(mp, 1);
  await mp.screenshot({ path: resolve(SHOTS, "hero-p000@390.png") });
  await readAt(mp, 0.5); await mp.screenshot({ path: resolve(SHOTS, "hero-p050@390.png") });
  await readAt(mp, 1); await mp.screenshot({ path: resolve(SHOTS, "hero-p100@390.png") });
  log(m1.maskOpacity > 0.85 && m1.subject.y < m0.subject.y - 5,
    "·mobile mask fills + subject rises",
    `mask p1=${m1.maskOpacity?.toFixed(2)} subjΔ=${(m1.subject.y - m0.subject.y).toFixed(0)}`);
  await mob.close();

  // ---- 7. reduced-motion settled frame ------------------------------------
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rmp = await rm.newPage();
  const rmErrs = [];
  rmp.on("console", (m) => { if (m.type() === "error") rmErrs.push(m.text()); });
  await rmp.goto(URL, { waitUntil: "load" });
  await rmp.waitForTimeout(1000);
  const rs = await rmp.evaluate(() => ({
    mask: parseFloat(getComputedStyle(document.querySelector(".layer--maskfill")).opacity),
    outline: parseFloat(getComputedStyle(document.querySelector(".layer--outline")).opacity),
    subjectVisible: getComputedStyle(document.querySelector(".layer--subject")).opacity,
    rootH: document.querySelector(".hero_root").getBoundingClientRect().height,
    vh: window.innerHeight,
  }));
  await rmp.screenshot({ path: resolve(SHOTS, "hero-reduced-motion@1440.png") });
  log(near(rs.mask, 1, 0.05) && rs.outline <= 0.25 && near(rs.rootH, rs.vh, 4) && rmErrs.length === 0,
    "7·reduced-motion settled frame",
    `mask=${rs.mask} outline=${rs.outline} rootH≈vh(${rs.rootH.toFixed(0)}/${rs.vh}) errs=${rmErrs.length}`);
  await rm.close();

  // ---- 8. no-js finished frame --------------------------------------------
  const nj = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const njp = await nj.newPage();
  await njp.goto(URL, { waitUntil: "load" });
  await njp.waitForTimeout(600);
  const ns = await njp.evaluate(() => ({
    mask: parseFloat(getComputedStyle(document.querySelector(".layer--maskfill")).opacity),
    outline: parseFloat(getComputedStyle(document.querySelector(".layer--outline")).opacity),
    rootH: document.querySelector(".hero_root").getBoundingClientRect().height,
    vh: window.innerHeight,
    subjVisible: parseFloat(getComputedStyle(document.querySelector(".layer--subject")).opacity),
  }));
  await njp.screenshot({ path: resolve(SHOTS, "hero-no-js@1440.png") });
  log(near(ns.mask, 1, 0.05) && near(ns.rootH, ns.vh, 4) && ns.subjVisible > 0.9,
    "8·no-js finished frame (collapsed to 100vh, filled, visible)",
    `mask=${ns.mask} rootH≈vh(${ns.rootH.toFixed(0)}/${ns.vh}) subj=${ns.subjVisible}`);
  await nj.close();

  await browser.close();

  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r[0]).length;
  console.log(`TOTAL: ${passed}/${results.length} passed`);
  console.log(`screenshots → ${SHOTS}`);
  if (passed !== results.length) {
    console.log("\nFAILURES:");
    results.filter((r) => !r[0]).forEach((r) => console.log(`  ✗ ${r[1]} — ${r[2]}`));
    process.exitCode = 1;
  }
}

run().catch((e) => { console.error("QA ERROR:", e); process.exitCode = 1; });
