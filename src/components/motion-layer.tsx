"use client";
import { useEffect } from "react";
import { useDashboard } from "./dashboard-provider";
export function MotionLayer({ route }: { route: string }) {
  const { data } = useDashboard();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let cleanup: (() => void) | undefined;
    let active = true;
    if (!reduced.matches)
      Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]).then(([{ gsap }, { ScrollTrigger }, { default: Lenis }]) => {
        if (!active) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
        const ticker = (time: number) => lenis.raf(time * 1000);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(ticker);
        const context = gsap.context(() => {
          document
            .querySelectorAll(
              ".view-section .panel, .view-section .membership-card, .view-section .member-card",
            )
            .forEach((element) => {
              gsap.from(element, {
                opacity: 0,
                y: 14,
                duration: 0.28,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 95%",
                  once: true,
                },
              });
            });
        });
        cleanup = () => {
          context.revert();
          gsap.ticker.remove(ticker);
          lenis.destroy();
        };
      });
    const onChange = () => {
      cleanup?.();
      cleanup = undefined;
    };
    reduced.addEventListener("change", onChange);
    return () => {
      active = false;
      cleanup?.();
      reduced.removeEventListener("change", onChange);
    };
  }, [route, data]);
  return null;
}
