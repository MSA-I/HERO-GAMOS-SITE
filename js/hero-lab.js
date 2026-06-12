/* =========================================================================
   GAMOS · Hero Lab — scroll/entrance orchestrator (sandbox)
   - Lenis smooth scroll (self-hosted vendor)
   - GSAP entrance timeline on load (--enter 0 → 1)
   - ScrollTrigger scrub over the 500vh track (writes --p 0 → 1)
   Defensive: if any vendor is missing OR the user prefers reduced motion,
   it forces the finished static frame (--enter:1) and bails — never a blank
   or half-revealed hero.
   ========================================================================= */

const root = document.documentElement;
const hero = document.querySelector(".hero_root");
const stage = document.querySelector(".hero_top");
const heroContent = document.querySelector(".hero-content");
const headline = document.querySelector(".hero-content__headline");
const supportingCopy = document.querySelectorAll(
  ".hero-content__eyebrow, .hero-content__sub, .hero-content__cta"
);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Guarantee the scene is shown in its finished state. Called on every bail. */
function showFinishedFrame() {
  root.style.setProperty("--enter", "1");
}

/** Vendors are loaded with `defer`; this module is `type=module` (also deferred),
 *  but order is not guaranteed across defer+module. Poll briefly for the globals. */
function waitForVendors(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = performance.now();
    (function poll() {
      const hasGsap = !!window.gsap;
      const hasST = !!(window.ScrollTrigger || (window.gsap && window.gsap.ScrollTrigger));
      if (hasGsap && hasST) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(poll);
    })();
  });
}

function initLenis() {
  if (reduceMotion || typeof window.Lenis !== "function") return null;
  try {
    const lenis = new window.Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false, // §8 spirit: never smooth-scroll touch (jank)
    });
    return lenis;
  } catch (e) {
    console.warn("[hero-lab] Lenis init failed, native scroll:", e.message);
    return null;
  }
}

function splitHeadlineWords(element) {
  if (!element || element.dataset.split === "true") return [];

  const wordSpans = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue.trim()) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const parts = node.nodeValue.split(/(\s+)/u);

    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/u.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }

      const mask = document.createElement("span");
      const inner = document.createElement("span");
      mask.className = "word-reveal";
      inner.className = "word-reveal__inner";
      inner.textContent = part;
      mask.appendChild(inner);
      fragment.appendChild(mask);
      wordSpans.push(inner);
    });

    node.parentNode.replaceChild(fragment, node);
  });

  element.dataset.split = "true";
  return wordSpans;
}

function animateHeroText(gsap) {
  if (!heroContent || !headline) return;

  const words = splitHeadlineWords(headline);
  const tl = gsap.timeline({ delay: 0.1 });

  if (words.length) {
    gsap.set(words, { y: "115%", willChange: "transform" });
    tl.to(words, {
      y: "0%",
      duration: 2,
      stagger: words.length > 5 ? { amount: 0.4 } : 0.1,
      ease: "power4.out",
      onComplete: () => gsap.set(words, { willChange: "auto" }),
    }, 0);
  }

  if (supportingCopy.length) {
    gsap.set(supportingCopy, { opacity: 0, y: 70, willChange: "transform, opacity" });
    tl.to(supportingCopy, {
      opacity: 1,
      duration: 0.12,
      stagger: 0.1,
      ease: "none",
    }, 0.4);
    tl.to(supportingCopy, {
      y: 0,
      duration: 2,
      stagger: 0.1,
      ease: "expo.out",
      onComplete: () => gsap.set(supportingCopy, { willChange: "auto" }),
    }, 0.4);
  }
}

async function main() {
  if (!hero || !stage) return showFinishedFrame();

  // Reduced motion → render the tasteful static frame the CSS already defines.
  if (reduceMotion) return showFinishedFrame();

  const ok = await waitForVendors();
  if (!ok) {
    console.warn("[hero-lab] GSAP/ScrollTrigger unavailable — static fallback.");
    return showFinishedFrame();
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger || gsap.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  // ---- Lenis ↔ ScrollTrigger sync -------------------------------------------
  const lenis = initLenis();
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ---- Entrance timeline (--enter 0 → 1) ------------------------------------
  // We animate a single proxy value and write it to the CSS var each tick, so
  // the entrance composes with the scroll var without competing for transforms.
  const enterState = { v: 0 };
  gsap.to(enterState, {
    v: 1,
    duration: 1.5,
    ease: "power3.out",
    delay: 0.1,
    onUpdate: () => root.style.setProperty("--enter", enterState.v.toFixed(4)),
    onComplete: () => root.style.setProperty("--enter", "1"),
  });
  animateHeroText(gsap);

  // ---- Scroll scrub (--p 0 → 1 across the 500vh track) ----------------------
  const scrubState = { v: 0 };
  ScrollTrigger.create({
    trigger: hero,
    start: "top top",
    end: "bottom bottom", // full 500vh
    scrub: 0.6,
    onUpdate: (self) => {
      scrubState.v = self.progress;
      root.style.setProperty("--p", self.progress.toFixed(4));
    },
  });

  // keep ST honest if fonts/images resize the layout late.
  // The SVG <text> mask (L3) + outline (L5) are geometry-LOAD-BEARING on Cinzel:
  // until the woff2 swaps in, the letters render in the fallback serif at a
  // different width, so the mask window + outline shift. The SVG re-rasterizes
  // the mask automatically on font swap (no blank risk — the fill just snaps to
  // the final glyphs), and we refresh ScrollTrigger so the 500vh mapping matches
  // the settled layout.
  window.addEventListener("load", () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
}

main().catch((e) => {
  console.error("[hero-lab] init error, showing static frame:", e);
  showFinishedFrame();
});
