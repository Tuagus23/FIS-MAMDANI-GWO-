"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-gate">
      <h1>Halaman belum dapat dimuat</h1>
      <p>Coba muat ulang halaman.</p>
      <button className="button button-primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
