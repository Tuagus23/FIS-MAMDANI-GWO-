import { animate } from "motion";

const slides = [...document.querySelectorAll("[data-team-slide]")];
const stage = document.querySelector("#loginTeamStage");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentIndex = 0;
let rotationTimer;
let transitioning = false;

if (slides.length && stage) {
  function stopRotation() {
    window.clearInterval(rotationTimer);
    rotationTimer = undefined;
  }

  function startRotation() {
    stopRotation();
    if (prefersReducedMotion.matches || document.hidden || stage.matches(":hover") || stage.contains(document.activeElement)) return;
    rotationTimer = window.setInterval(() => transitionTo((currentIndex + 1) % slides.length), 6800);
  }

  async function transitionTo(nextIndex) {
    if (transitioning || nextIndex === currentIndex) return;
    transitioning = true;
    const outgoing = slides[currentIndex];
    const incoming = slides[nextIndex];
    incoming.hidden = false;

    const easeOut = [0.23, 1, 0.32, 1];
    const enter = prefersReducedMotion.matches
      ? { opacity: [0, 1] }
      : { opacity: [0, 1], y: [6, 0] };
    const leave = prefersReducedMotion.matches
      ? { opacity: 0 }
      : { opacity: 0, y: 6 };
    const duration = prefersReducedMotion.matches ? 0.16 : 0.22;
    const outgoingAnimation = animate(outgoing, leave, { duration, ease: easeOut });
    const incomingAnimation = animate(incoming, enter, { duration, ease: easeOut });

    await Promise.all([outgoingAnimation.finished, incomingAnimation.finished]);
    outgoing.hidden = true;
    outgoing.classList.remove("is-current");
    incoming.classList.add("is-current");
    outgoingAnimation.cancel();
    incomingAnimation.cancel();
    currentIndex = nextIndex;
    transitioning = false;
  }

  stage.addEventListener("pointerenter", stopRotation);
  stage.addEventListener("pointerleave", startRotation);
  stage.addEventListener("focusin", stopRotation);
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) startRotation();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRotation();
    else startRotation();
  });
  prefersReducedMotion.addEventListener("change", () => {
    if (prefersReducedMotion.matches) stopRotation();
    else startRotation();
  });

  startRotation();
}
