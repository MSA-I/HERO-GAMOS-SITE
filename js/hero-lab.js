/* =========================================================================
   GAMOS · Hero Lab — FIND animation parity test
   Purpose: temporarily run the hero with FIND's original animation structure,
   with our visual assets only. Custom GAMOS copy is disabled until visual QA.
   ========================================================================= */

const hero = document.querySelector(".hero_root");
const stage = document.querySelector(".hero_top");
const sky = document.querySelector(".layer--sky");
const subject = document.querySelector(".layer--subject");
const composite = document.querySelector(".layer--maskfill");
const compositeSubject = document.querySelector(".layer--maskfill .maskfill__subject");
const cloudStart = document.querySelector(".cloud--start");
const cloudEnd = document.querySelector(".cloud--end");
const outline = document.querySelector(".layer--outline");
const smoke = document.querySelector(".layer--smoke");
const content = document.querySelector(".layer--content");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function showFrame() {
  document.documentElement.classList.add("is-ready");
  if (hero) hero.style.visibility = "visible";
}

function waitForVendors(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = performance.now();
    (function poll() {
      const gsap = window.gsap;
      const st = window.ScrollTrigger || (gsap && gsap.ScrollTrigger);
      if (gsap && st) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(poll);
    })();
  });
}

function initLenis(ScrollTrigger, gsap) {
  if (reduceMotion || typeof window.Lenis !== "function") return null;
  try {
    const lenis = new window.Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return lenis;
  } catch (error) {
    console.warn("[hero-lab] Lenis init failed, native scroll:", error.message);
    return null;
  }
}

async function main() {
  if (!hero || !stage) return;

  if (reduceMotion) {
    showFrame();
    return;
  }

  const ok = await waitForVendors();
  if (!ok) {
    console.warn("[hero-lab] GSAP/ScrollTrigger unavailable — static frame.");
    showFrame();
    return;
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger || gsap.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  initLenis(ScrollTrigger, gsap);

  // FIND entrance timeline: reveal root, slow backdrop scale, clouds/smoke/image entrance.
  const enter = gsap.timeline({ paused: true });
  enter.fromTo(hero, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0);
  enter.from(sky, { scale: 1.1, duration: 5, ease: "expo.out" }, 0);
  enter.from(cloudStart, { y: "50%", duration: 3, ease: "expo.out" }, 0);
  enter.from(cloudEnd, { y: "100%", duration: 4, ease: "expo.out" }, 0.1);
  enter.from([subject?.querySelector("img"), compositeSubject?.querySelector("img")].filter(Boolean), {
    opacity: 0,
    duration: 0.6,
  }, 0.2);
  enter.from([subject?.querySelector("img"), compositeSubject?.querySelector("img")].filter(Boolean), {
    y: "10%",
    duration: 3,
    ease: "expo.out",
  }, 0.2);

  showFrame();
  setTimeout(() => requestAnimationFrame(() => enter.play()), 200);

  // FIND scroll timeline: direct transforms, no custom CSS-variable animation.
  const scrollTl = gsap.timeline();
  scrollTl.to([subject, compositeSubject].filter(Boolean), {
    y: "-40%",
    scale: 1.3,
    duration: 1,
  }, 0);
  scrollTl.to(smoke, { y: "0%", duration: 1 }, 0);
  scrollTl.to(cloudStart, { x: "-15%", duration: 1 }, 0);
  scrollTl.to(cloudEnd, { x: "15%", duration: 1 }, 0);
  scrollTl.to(outline, { y: "20%", scale: 0.9, duration: 1 }, 0);
  scrollTl.to(outline, { opacity: 0, duration: 0.2 }, 0);
  scrollTl.to(outline, { opacity: 1, duration: 0.01 }, 0.1);
  scrollTl.to(outline, { opacity: 0, duration: 0.2 }, 0.28);
  scrollTl.to(composite, { opacity: 1, duration: 0.1 }, 0.3);
  scrollTl.to(subject, { opacity: 0, duration: 0.1 }, 0.3);
  scrollTl.to(content, { opacity: 0, duration: 0.01 }, 0);
  scrollTl.add(() => {}, 1);

  ScrollTrigger.create({
    trigger: hero,
    animation: scrollTl,
    start: "top top",
    end: "bottom top",
    scrub: 0.1,
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

main().catch((error) => {
  console.error("[hero-lab] init error, showing static frame:", error);
  showFrame();
});
