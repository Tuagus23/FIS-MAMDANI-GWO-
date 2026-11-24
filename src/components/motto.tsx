"use client";
import { useEffect, useRef } from "react";
import { NetworkArt } from "./network-art";
export default function Motto() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  function open(detail: number) {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.toggleAttribute("data-instant", detail === 0);
    dialog.current.showModal();
    timer.current = setTimeout(() => dialog.current?.close(), 2400);
  }
  return (
    <div className="motto-page is-entering">
      <blockquote className="motto-poster">
        <div className="motto-first-thought">
          <p className="motto-intro">Tidak ada manusia yang</p>
          <p className="motto-word-pair">
            <span>Pintar</span>
            <span className="motto-slash">/</span>
            <span>Bodoh</span>
          </p>
          <div className="motto-divider" aria-hidden="true">
            <span />
          </div>
        </div>
        <div className="motto-second-thought">
          <p className="motto-intro">Hanya ada manusia yang</p>
          <p className="motto-learning">
            <span>Duluan belajar</span>
            <span>dan lebih giat belajar</span>
          </p>
        </div>
        <NetworkArt />
      </blockquote>
      <div className="motto-footer">
        <p className="motto-signoff">
          Pegangan Kelompok 3 · Pengantar Komputasi Lunak
        </p>
        <button
          ref={trigger}
          className="motto-art"
          type="button"
          aria-label="Buka kejutan tersembunyi"
          aria-haspopup="dialog"
          aria-controls="mottoSurprise"
          onClick={(e) => open(e.detail)}
        >
          <img
            src="/images/motto/learning-atmosphere.jpg"
            width={493}
            height={512}
            alt=""
            loading="lazy"
          />
        </button>
      </div>
      <dialog
        ref={dialog}
        id="mottoSurprise"
        className="motto-surprise"
        aria-labelledby="mottoSurpriseHeading"
        data-lenis-prevent
        onClose={() => {
          clearTimeout(timer.current);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const bounds = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom
          )
            e.currentTarget.close();
        }}
      >
        <h2 id="mottoSurpriseHeading" className="sr-only">
          Kejutan!
        </h2>
        <img
          src="/images/motto/surprise.jpg"
          width={533}
          height={536}
          alt="Meme pria menunjuk dengan tulisan: Banyak omong lu Suki."
        />
        <button
          className="motto-surprise-close"
          type="button"
          aria-label="Tutup kejutan"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </dialog>
    </div>
  );
}
