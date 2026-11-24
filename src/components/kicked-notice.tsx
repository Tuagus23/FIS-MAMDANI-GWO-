"use client";

import { useEffect, useRef } from "react";

export function KickedNotice({ onDismiss }: { onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="kicked-notice"
      aria-labelledby="kickedTitle"
      aria-describedby="kickedDescription"
      onClose={onDismiss}
    >
      <img
        src="/images/motto/surprise.jpg"
        width={533}
        height={536}
        alt="Stiker bercanda: Banyak omong lu Suki."
      />
      <div className="kicked-notice-copy">
        <h2 id="kickedTitle">Sesi kamu kena kick</h2>
        <p id="kickedDescription">Ini untuk senang-senang saja.</p>
        <p className="kicked-notice-help">
          Super admin mengakhiri sesi ini. Akunmu tetap bisa login kembali.
        </p>
        <button
          className="login-submit"
          type="button"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Kembali ke login
        </button>
      </div>
    </dialog>
  );
}
