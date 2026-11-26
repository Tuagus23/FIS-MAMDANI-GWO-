"use client";
import { useEffect, useRef } from "react";
import type Lenis from "lenis";

export function MotionLayer({ route }: { route: string }) {
  const scroll = useRef<Lenis | null>(null);
  useEffect(() => {
    if (route === "/dasar-proyek") {
      const anchor = document.getElementById(window.location.hash.slice(1));
      if (anchor) {
        if (scroll.current) {
          scroll.current.scrollTo(anchor, { immediate: true, force: true });
        } else {
          anchor.scrollIntoView({ behavior: "instant" });
        }
        return;
      }
    }
    if (scroll.current)
      scroll.current.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.querySelector<HTMLElement>(".dashboard-content");
    if (!root) return;
    let disposed = false;
    let generation = 0;
    let stop: (() => void) | undefined;
    function setKeyboard() {
      document.documentElement.dataset.inputMode = "keyboard";
    }
    function setPointer() {
      document.documentElement.dataset.inputMode = "pointer";
    }
    document.addEventListener("keydown", setKeyboard, { passive: true });
    document.addEventListener("pointerdown", setPointer, { passive: true });
    async function start() {
      const version = ++generation;
      stop?.();
      stop = undefined;
      if (media.matches) return;
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] =
          await Promise.all([
            import("gsap"),
            import("gsap/ScrollTrigger"),
            import("lenis"),
          ]);
        if (disposed || media.matches || version !== generation) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({
          autoRaf: false,
          lerp: 0.12,
          smoothWheel: true,
          syncTouch: false,
        });
        scroll.current = lenis;
        const ticker = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(ticker);
        lenis.on("scroll", ScrollTrigger.update);
        const seen = new WeakSet<Element>();
        const context = gsap.context(() => {});
        let frame = 0;
        const scan = () => {
          root!
            .querySelectorAll<HTMLElement>(
              ".panel, .member-card, .membership-card",
            )
            .forEach((element) => {
              if (seen.has(element)) return;
              seen.add(element);
              if (
                element.getBoundingClientRect().top <
                window.innerHeight * 1.05
              )
                return;
              context.add(() => {
                ScrollTrigger.create({
                  trigger: element,
                  start: "top 94%",
                  once: true,
                  onEnter: () => {
                    if (
                      document.documentElement.dataset.inputMode === "keyboard"
                    )
                      return;
                    context.add(() => {
                      gsap.fromTo(
                        element,
                        { opacity: 0.6, y: 8 },
                        {
                          opacity: 1,
                          y: 0,
                          duration: 0.25,
                          ease: "power3.out",
                          clearProps: "opacity,transform",
                        },
                      );
                    });
                  },
                });
              });
            });
          ScrollTrigger.refresh();
        };
        const schedule = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(scan);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(root!, { childList: true, subtree: true });
        const resize = new ResizeObserver(schedule);
        resize.observe(root!);
        schedule();
        stop = () => {
          observer.disconnect();
          resize.disconnect();
          cancelAnimationFrame(frame);
          context.revert();
          gsap.ticker.remove(ticker);
          lenis.destroy();
          if (scroll.current === lenis) scroll.current = null;
        };
      } catch {
        /* Native scrolling remains available when optional animation modules fail. */
      }
    }
    void start();
    media.addEventListener("change", start);
    return () => {
      disposed = true;
      generation += 1;
      stop?.();
      media.removeEventListener("change", start);
      document.removeEventListener("keydown", setKeyboard);
      document.removeEventListener("pointerdown", setPointer);
    };
  }, []);
  return null;
}
