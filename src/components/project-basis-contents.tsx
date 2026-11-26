"use client";

import { useEffect, useState } from "react";
import styles from "./project-basis.module.css";

interface ContentsItem {
  id: string;
  short: string;
}

export function ProjectBasisContents({ topics }: { topics: readonly ContentsItem[] }) {
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const topbar = document.querySelector(".dashboard-topbar");
    const sections = topics.map(({ id }) => document.getElementById(id));
    let frame = 0;

    function update() {
      const readingTop = (topbar?.getBoundingClientRect().bottom ?? 0) + 28;
      const readingLine = readingTop + Math.min(120, window.innerHeight * 0.16);
      let visibleSection: string | null = null;

      for (const section of sections) {
        if (!section || section.getBoundingClientRect().top > readingLine) break;
        visibleSection = section.id;
      }
      setCurrentId(visibleSection);
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    window.addEventListener("pageshow", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, [topics]);

  return (
    <nav className={styles.contents} aria-label="Daftar isi Dasar proyek">
      <h2>Di halaman ini</h2>
      <ol>
        {topics.map(({ id, short }, index) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={currentId === id ? "location" : undefined}>
              <span className={styles.contentsNumber} aria-hidden="true">
                {id === "daftar-pustaka" ? null : index + 1}
              </span>
              {short}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
