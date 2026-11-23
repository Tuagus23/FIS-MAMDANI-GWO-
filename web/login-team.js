import { animate } from "motion";

const slides = [...document.querySelectorAll("[data-team-slide]")];
const stage = document.querySelector("#loginTeamStage");
const progress = document.querySelector("#loginTeamProgress");
const pauseButton = document.querySelector("#loginTeamPause");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentIndex = 0;
let rotationTimer;
let userPaused = prefersReducedMotion.matches;
let transitioning = false;

function updateProgress() {
  progress.innerHTML = `${String(currentIndex + 1).padStart(2, "0")} <i>/</i> ${String(slides.length).padStart(2, "0")}`;
}

function updatePauseButton() {
  pauseButton.textContent = userPaused ? "Putar" : "Jeda";
  pauseButton.setAttribute("aria-label", userPaused ? "Lanjutkan rotasi otomatis" : "Jeda rotasi otomatis");
  pauseButton.setAttribute("aria-pressed", String(userPaused));
  pauseButton.disabled = prefersReducedMotion.matches;
  if (prefersReducedMotion.matches) {
    pauseButton.textContent = "Gerak nonaktif";
    pauseButton.setAttribute("aria-label", "Rotasi otomatis nonaktif karena preferensi pengurangan gerak");
  }
}

function stopRotation() {
  window.clearInterval(rotationTimer);
  rotationTimer = undefined;
}

function startRotation() {
  stopRotation();
  if (userPaused || prefersReducedMotion.matches || stage.matches(":hover") || stage.contains(document.activeElement)) return;
  rotationTimer = window.setInterval(() => transitionTo((currentIndex + 1) % slides.length), 5200);
}

async function transitionTo(nextIndex) {
  if (transitioning || nextIndex === currentIndex) return;
  transitioning = true;
  const outgoing = slides[currentIndex];
  const incoming = slides[nextIndex];
  incoming.hidden = false;

  if (prefersReducedMotion.matches) {
    outgoing.hidden = true;
    outgoing.classList.remove("is-current");
    incoming.classList.add("is-current");
  } else {
    const outgoingAnimation = animate(outgoing, { opacity: 0, x: -14 }, { duration: 0.24, ease: "easeIn" });
    const incomingAnimation = animate(incoming, { opacity: [0, 1], x: [14, 0] }, { duration: 0.42, ease: [0.22, 1, 0.36, 1] });
    await Promise.all([outgoingAnimation.finished, incomingAnimation.finished]);
    outgoing.hidden = true;
    outgoing.classList.remove("is-current");
    incoming.classList.add("is-current");
    outgoingAnimation.cancel();
    incomingAnimation.cancel();
  }

  currentIndex = nextIndex;
  updateProgress();
  transitioning = false;
}

document.querySelector("#loginTeamPrevious").addEventListener("click", () => {
  transitionTo((currentIndex - 1 + slides.length) % slides.length);
});
document.querySelector("#loginTeamNext").addEventListener("click", () => {
  transitionTo((currentIndex + 1) % slides.length);
});
pauseButton.addEventListener("click", () => {
  userPaused = !userPaused;
  updatePauseButton();
  if (userPaused) stopRotation();
  else startRotation();
});

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
prefersReducedMotion.addEventListener("change", (event) => {
  if (event.matches) userPaused = true;
  updatePauseButton();
  startRotation();
});

updatePauseButton();
startRotation();
