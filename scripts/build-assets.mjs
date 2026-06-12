/**
 * hero-lab asset builder — SANDBOX ONLY.
 *
 * Faithful to the "FIND" hero layer recipe (see findrealestate-clone/
 * איך-ההירו-בנוי.md): a rising cut-out SUBJECT, a second copy of that subject
 * masked through the wordmark letters, TWO distinct clouds, and a separate
 * rising SMOKE band — composited over a warm SKY.
 *
 * Reads READ-ONLY masters under GAMOS-DOCS (Constitution §7 — never edited) and
 * emits WebP assets into hero-lab/assets/ ONLY. Touches nothing else.
 *
 *   node hero-lab/scripts/build-assets.mjs
 *
 * Outputs (8 files):
 *   assets/sky.webp / sky-mobile.webp        — L1 warm sky backdrop
 *   assets/subject.webp / subject-mobile.webp — L2 rising cut-out ridge (+ L3 fill source)
 *   assets/cloud-left.webp / cloud-right.webp — L4 two DISTINCT keyed cloud cut-outs
 *   assets/smoke.webp                         — L6 rising haze band
 *
 * SOURCE NOTES (corrected from the plan after empirical inspection):
 *   - SKY uses comfy/…_00003 — a clean warm desert-sky photo. The plan named
 *     …_00001, but that file is a screenshot of the FIND website itself
 *     (burned-in "Find What Moves You" + FIND logo) → must NOT be a backdrop.
 *   - SUBJECT uses HERO/מדבר-2.png — it already carries a REAL transparent sky
 *     (clean alpha), so it needs NO background-removal. (The "מחולצות/אולם|ריזורט"
 *     frames are fully opaque AND segment poorly — verified — so the user chose
 *     the desert ridge, which is also the truest equivalent of FIND's landform.)
 *   - CLOUDS/SMOKE are luminance-keyed from the comfy cloud bank. The plan named
 *     מדבר.png, but that master is a ridge on a transparent sky with NO clouds.
 *
 * Cloud/smoke extraction = luminance key inside a cropped band (clouds are the
 * bright element; the ridge is darker) + edge feathering so crop seams dissolve.
 * Two NON-OVERLAPPING crops give genuinely different cloud shapes (fixes the old
 * "one band reused 3×" deviation). No 3D, no model — pure 2D compositing source.
 */
import sharp from "../../node_modules/sharp/lib/index.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAB = resolve(__dirname, "..");
const OUT = resolve(LAB, "assets");
const DOCS = resolve(LAB, "../../GAMOS-DOCS/תמונות לאנימציית האתר");

// READ-ONLY source masters (Constitution §7 — never edited, only read).
const SKY_SRC = resolve(DOCS, "HERO/comfy/z-image-upscaled_00003_.png"); // clean warm sky
const SUBJECT_SRC = resolve(DOCS, "HERO/מדבר-2.png"); // ridge, real transparent sky
// 00002 carries a full-width rolling cloud band across its lower third (verified
// by luma probe) — 00003's clouds were scattered to one side, so the left crop
// came out near-empty. 00002 gives two genuinely distinct cloud cut-outs.
const CLOUD_SRC = resolve(DOCS, "HERO/comfy/z-image-upscaled_00002_.png"); // cloud bank

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (lo, hi, x) => {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// L1 · sky — warm desert backdrop (the soft, distant range gives depth behind
// the sharp dark ridge that rises in front).
// ---------------------------------------------------------------------------
async function buildSky() {
  await sharp(SKY_SRC)
    .resize({ width: 2000, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(resolve(OUT, "sky.webp"));
  await sharp(SKY_SRC)
    .resize({ width: 1080, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(resolve(OUT, "sky-mobile.webp"));
  console.log("✓ sky.webp + sky-mobile.webp");
}

// ---------------------------------------------------------------------------
// L2 · subject — the rising cut-out ridge (FIND hero_house). מדבר-2.png already
// has a real transparent sky, so we keep its alpha and just trim to the alpha
// bbox (drops the empty transparent margin so the ridge anchors to the bottom).
// ---------------------------------------------------------------------------
async function buildSubject() {
  const meta = await sharp(SUBJECT_SRC).metadata();
  if (!meta.hasAlpha) {
    throw new Error(`SUBJECT_SRC has no alpha channel — expected transparent sky in ${SUBJECT_SRC}`);
  }
  // trim() crops uniform/transparent borders to the content bbox.
  await sharp(SUBJECT_SRC)
    .trim({ threshold: 10 })
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 92 })
    .toFile(resolve(OUT, "subject.webp"));
  await sharp(SUBJECT_SRC)
    .trim({ threshold: 10 })
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 78, alphaQuality: 90 })
    .toFile(resolve(OUT, "subject-mobile.webp"));
  console.log("✓ subject.webp + subject-mobile.webp (alpha preserved, trimmed)");
}

/**
 * Luminance-key a cropped band of a (cloud-bearing) source into an RGBA cut-out:
 * bright pixels (clouds) → opaque warm-white; dark pixels (ridge) → transparent.
 * Feathers all four edges so the rectangular crop dissolves.
 */
async function keyBand(src, { left, top, width, height }, opts) {
  const {
    LO = 150,
    HI = 210,
    fadeTopFrac = 0.22,
    fadeBottomFrac = 0.1,
    fadeSideFrac = 0.05,
    blur = 0,
    warmR = 252,
    warmG = 248,
    warmB = 242,
    warmMix = 0.6,
  } = opts;

  let pipe = sharp(src).extract({ left, top, width, height });
  if (blur > 0) pipe = pipe.blur(blur);

  const { data, info } = await pipe.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels; // 3
  const out = Buffer.alloc(w * h * 4);

  const fadeTop = Math.round(h * fadeTopFrac);
  const fadeBottom = Math.round(h * fadeBottomFrac);
  const fadeSide = Math.round(w * fadeSideFrac);

  for (let y = 0; y < h; y++) {
    let vy = 1;
    if (fadeTop > 0 && y < fadeTop) vy = smoothstep(0, fadeTop, y);
    else if (fadeBottom > 0 && y > h - fadeBottom) vy = smoothstep(0, fadeBottom, h - y);

    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * ch;
      const di = (y * w + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      let hx = 1;
      if (fadeSide > 0 && x < fadeSide) hx = smoothstep(0, fadeSide, x);
      else if (fadeSide > 0 && x > w - fadeSide) hx = smoothstep(0, fadeSide, w - x);

      const key = smoothstep(LO, HI, luma);
      const alpha = clamp(Math.round(255 * key * vy * hx), 0, 255);

      out[di] = clamp(Math.round(r * (1 - warmMix) + warmR * warmMix), 0, 255);
      out[di + 1] = clamp(Math.round(g * (1 - warmMix) + warmG * warmMix), 0, 255);
      out[di + 2] = clamp(Math.round(b * (1 - warmMix) + warmB * warmMix), 0, 255);
      out[di + 3] = alpha;
    }
  }
  return { out, w, h };
}

// ---------------------------------------------------------------------------
// L4 · two DISTINCT clouds — non-overlapping left/right crops of the cloud bank.
// ---------------------------------------------------------------------------
async function buildClouds() {
  const meta = await sharp(CLOUD_SRC).metadata();
  const W = meta.width;
  const H = meta.height;

  // The rolling cloud band sits across the lower third of the comfy scene
  // (verified by luma probe: y ~58-100% is the cloud-rich strip).
  const bandTop = Math.round(H * 0.58);
  const bandH = Math.round(H * 0.4);
  const cropW = Math.round(W * 0.46); // 46% wide → left[0..46] and right[54..100] do NOT overlap

  const left = await keyBand(
    CLOUD_SRC,
    { left: 0, top: bandTop, width: cropW, height: bandH },
    { LO: 150, HI: 205 }
  );
  await sharp(left.out, { raw: { width: left.w, height: left.h, channels: 4 } })
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90 })
    .toFile(resolve(OUT, "cloud-left.webp"));

  const right = await keyBand(
    CLOUD_SRC,
    { left: W - cropW, top: bandTop, width: cropW, height: bandH },
    { LO: 150, HI: 205 }
  );
  await sharp(right.out, { raw: { width: right.w, height: right.h, channels: 4 } })
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90 })
    .toFile(resolve(OUT, "cloud-right.webp"));

  console.log(`✓ cloud-left.webp + cloud-right.webp (2 distinct ${cropW}×${bandH} crops)`);
}

// ---------------------------------------------------------------------------
// L6 · smoke — a soft low haze strip, lower thresholds + heavy blur so it reads
// as rising fog, not topography.
// ---------------------------------------------------------------------------
async function buildSmoke() {
  const meta = await sharp(CLOUD_SRC).metadata();
  const W = meta.width;
  const H = meta.height;

  const band = await keyBand(
    CLOUD_SRC,
    { left: Math.round(W * 0.18), top: Math.round(H * 0.74), width: Math.round(W * 0.64), height: Math.round(H * 0.24) },
    { LO: 120, HI: 185, fadeTopFrac: 0.4, fadeBottomFrac: 0.08, blur: 3, warmMix: 0.66 }
  );
  await sharp(band.out, { raw: { width: band.w, height: band.h, channels: 4 } })
    .resize({ width: 1500, withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 88 })
    .toFile(resolve(OUT, "smoke.webp"));
  console.log("✓ smoke.webp (soft haze band)");
}

async function main() {
  console.log("hero-lab asset build (FIND-faithful)");
  console.log("sky   :", SKY_SRC);
  console.log("subj  :", SUBJECT_SRC);
  console.log("cloud :", CLOUD_SRC);
  await buildSky();
  await buildSubject();
  await buildClouds();
  await buildSmoke();
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error("BUILD FAILED:", e.message);
  process.exit(1);
});
