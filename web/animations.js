import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate } from "motion";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const cardSelector = ".panel, .metric-card, .membership-card, .seed-table-panel, .sim-metric";
const revealedElements = new Set();
const activeAnimations = new Map();
let animationEvents;
let lenis;
let initialized = false;

gsap.registerPlugin(ScrollTrigger);

function animateCard(card, isActive) {
  activeAnimations.get(card)?.stop();
  const animation = animate(
    card,
    { scale: isActive ? 1.012 : 1, y: isActive ? -2 : 0 },
    { type: "spring", stiffness: 460, damping: 34 },
  );
  activeAnimations.set(card, animation);
}

function cardFromEvent(event) {
  return event.target instanceof Element ? event.target.closest(cardSelector) : null;
}

function bindCardMotion() {
  animationEvents = new AbortController();
  const options = { signal: animationEvents.signal };

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const card = cardFromEvent(event);
    if (card && !card.contains(event.relatedTarget)) animateCard(card, true);
  }, options);

  document.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const card = cardFromEvent(event);
    if (card && !card.contains(event.relatedTarget)) animateCard(card, false);
  }, options);

  document.addEventListener("focusin", (event) => {
    const card = cardFromEvent(event);
    if (card) animateCard(card, true);
  }, options);

  document.addEventListener("focusout", (event) => {
    const card = cardFromEvent(event);
    if (card && !card.contains(event.relatedTarget)) animateCard(card, false);
  }, options);
}

function visibleRevealTargets() {
  const activeView = document.querySelector(".view-section:not(.hidden)");
  if (!activeView) return [];
  return [
    document.querySelector(".page-heading"),
    ...activeView.querySelectorAll(".panel, .metric-card, .membership-card, .seed-table-panel, .sim-metric, .metric-glossary, .info-strip"),
  ].filter((element) => element && !element.closest(".hidden"));
}

function refresh() {
  if (!initialized || prefersReducedMotion.matches) return;

  visibleRevealTargets().forEach((element) => {
    if (revealedElements.has(element)) return;
    revealedElements.add(element);
    element.classList.add("motion-reveal");
    gsap.fromTo(element,
      { autoAlpha: 0, "--motion-reveal-y": "14px" },
      {
        autoAlpha: 1,
        "--motion-reveal-y": "0px",
        duration: 0.52,
        ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 92%", once: true },
      },
    );
  });

  requestAnimationFrame(() => ScrollTrigger.refresh());
}

function ticker(time) {
  lenis?.raf(time * 1000);
}

function stop() {
  if (!initialized) return;
  initialized = false;
  animationEvents?.abort();
  activeAnimations.forEach((animation) => animation.stop());
  activeAnimations.clear();
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  gsap.killTweensOf([...revealedElements]);
  gsap.set([...revealedElements], { clearProps: "opacity,visibility,--motion-reveal-y" });
  revealedElements.forEach((element) => element.classList.remove("motion-reveal"));
  revealedElements.clear();
  document.documentElement.classList.remove("motion-ready");
  if (lenis) {
    gsap.ticker.remove(ticker);
    lenis.destroy();
    lenis = undefined;
  }
}

function initialize() {
  if (initialized || prefersReducedMotion.matches) return;
  initialized = true;
  document.documentElement.classList.add("motion-ready");
  lenis = new Lenis({ autoRaf: false, anchors: true, smoothWheel: true, syncTouch: false, lerp: 0.12 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(ticker);
  gsap.ticker.lagSmoothing(0);
  bindCardMotion();
  refresh();
}

function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo({ top: 0, behavior: "auto" });
}

prefersReducedMotion.addEventListener("change", (event) => {
  if (event.matches) stop();
  else initialize();
});

window.dashboardMotion = { initialize, refresh, scrollToTop };
