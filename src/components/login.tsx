"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { api, getAuthClient, readResponse } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { BrandMark } from "./brand-mark";
export function Login() {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [reveal, setReveal] = useState(false);
  const [setup, setSetup] = useState<Session | null>(null),
    [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false);
  const failureAudio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let active = true;
    const type =
      new URLSearchParams(location.hash.slice(1)).get("type") ||
      new URLSearchParams(location.search).get("type");
    const status = new URLSearchParams(location.search).get("status");
    getAuthClient()
      .then(async (client) => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setReady(true);
        if (data.session) {
          await api("/api/datasets");
          if (!active) return;
          if (type === "invite") setSetup(data.session);
          else window.location.replace("/");
        } else if (type === "invite")
          setMessage(
            "Tautan undangan tidak berlaku atau sudah kedaluwarsa. Minta administrator mengirim tautan baru.",
          );
        else if (status === "expired")
          setMessage("Sesi berakhir. Silakan masuk kembali.");
      })
      .catch((error) => {
        if (active)
          setMessage(errorMessage(error, "Login belum dikonfigurasi."));
      });
    return () => {
      active = false;
    };
  }, []);
  async function playFailureAudio() {
    const audio = failureAudio.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    try {
      await audio.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setAudioBlocked(false);
    failureAudio.current?.pause();
    try {
      const client = await getAuthClient();
      if (setup) {
        if (password.length < 10)
          throw new Error("Kata sandi minimal 10 karakter.");
        if (password !== confirm)
          throw new Error("Kata sandi yang diketik belum sama.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        window.location.replace("/");
        return;
      }
      if (identifier.includes("@")) {
        throw new Error("Gunakan NIM atau nama terakhir yang terdaftar.");
      }
      const tokens = await readResponse<{
        access_token: string;
        refresh_token: string;
      }>("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const { data, error } = await client.auth.setSession(tokens);
      if (error) throw error;
      if (!data.session)
        throw new Error("NIM/nama terakhir atau kata sandi belum benar.");
      try {
        await api("/api/datasets");
      } catch (error) {
        await client.auth.signOut({ scope: "local" });
        throw error;
      }
      setSuccess(true);
      setMessage("Login berhasil. Membuka dashboard…");
      window.location.replace("/");
    } catch (error) {
      setMessage(errorMessage(error));
      if (!setup) await playFailureAudio();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <main className="login-shell">
        <section className="login-intro" aria-labelledby="loginIntroTitle">
          <Link className="login-brand" href="/login" aria-label="Fuzzy CH WSN">
            <BrandMark />
            <span>Fuzzy CH WSN</span>
          </Link>
          <div className="login-intro-copy">
            <h1 id="loginIntroTitle">
              Analisis jaringan sensor dalam satu ruang kerja.
            </h1>
            <p>
              Bandingkan FUZZY, LEACH, dan GWO. Tinjau validasi model, fungsi
              keanggotaan, lalu jalankan skenario baru.
            </p>
            <div
              className="login-protocols"
              aria-label="Protokol yang dibandingkan"
            >
              <span>
                <i className="protocol-dot" aria-hidden="true" />
                FUZZY
              </span>
              <span>
                <i className="protocol-dot leach" aria-hidden="true" />
                LEACH
              </span>
              <span>
                <i className="protocol-dot gwo" aria-hidden="true" />
                GWO
              </span>
            </div>
          </div>
          <aside className="login-qr" aria-labelledby="loginQrTitle">
            <div className="login-qr-copy">
              <h2 id="loginQrTitle">Bagikan akses cepat</h2>
              <p>
                Pindai QR dari ponsel untuk membuka halaman login dashboard.
              </p>
              <a
                href="/qr-dashboard.png"
                download="qr-dashboard-fuzzy-ch-wsn.png"
              >
                Unduh QR
              </a>
            </div>
            <img
              src="/qr-dashboard.png"
              width={96}
              height={96}
              alt="QR untuk membuka login dashboard"
            />
          </aside>
          <p className="login-credit">Dashboard analisis FUZZY CH WSN</p>
        </section>
        <section className="login-form-side" aria-labelledby="loginTitle">
          <div className="login-card">
            <h2 id="loginTitle">
              {setup ? "Aktifkan akun" : "Masuk ke dashboard"}
            </h2>
            <p className="login-subtitle">
              {setup
                ? "Buat kata sandi pribadi sebelum membuka dashboard."
                : "Gunakan akun individual yang diberikan administrator."}
            </p>
            {message && (
              <div
                className={`login-message ${success ? "login-message-info" : "login-message-error"}`}
                role="alert"
              >
                {message}
              </div>
            )}
            {!ready && !message && <p role="status">Menyiapkan login…</p>}
            {!success && (
              <form className="login-form" onSubmit={submit}>
                {setup ? (
                  <p className="setup-email">{setup.user.email}</p>
                ) : (
                  <>
                    <label className="login-label" htmlFor="identifierInput">
                      NIM atau nama terakhir
                    </label>
                    <input
                      id="identifierInput"
                      className="login-input"
                      type="text"
                      name="username"
                      autoComplete="username"
                      placeholder="Masukkan NIM atau nama terakhir"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </>
                )}
                <label
                  className="login-label login-password-label"
                  htmlFor="passwordInput"
                >
                  {setup ? "Kata sandi baru" : "Kata sandi"}
                </label>
                <div className="password-wrap">
                  <input
                    id="passwordInput"
                    className="login-input"
                    type={reveal ? "text" : "password"}
                    autoComplete={setup ? "new-password" : "current-password"}
                    placeholder={
                      setup ? "Minimal 10 karakter" : "Masukkan kata sandi"
                    }
                    minLength={setup ? 10 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={busy}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={
                      reveal ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                    }
                    aria-pressed={reveal}
                    onClick={() => setReveal((value) => !value)}
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="2.2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      {reveal && (
                        <path
                          d="M3 3l14 14"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </button>
                </div>
                {setup && (
                  <>
                    <label
                      className="login-label login-password-label"
                      htmlFor="confirmPassword"
                    >
                      Ulangi kata sandi
                    </label>
                    <input
                      id="confirmPassword"
                      className="login-input"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </>
                )}
                <button
                  className="login-submit"
                  type="submit"
                  disabled={!ready || busy}
                >
                  {busy && (
                    <span className="login-spinner" aria-hidden="true" />
                  )}
                  {busy ? "Memproses…" : setup ? "Simpan kata sandi" : "Masuk"}
                </button>
              </form>
            )}
            {audioBlocked && (
              <button
                className="login-submit"
                type="button"
                onClick={playFailureAudio}
              >
                Putar ulang audio
              </button>
            )}
            {success && (
              <Link className="login-help block" href="/">
                Buka dashboard sekarang
              </Link>
            )}
            {!success && (
              <p className="login-help">
                {setup
                  ? "Gunakan kata sandi yang berbeda dari akun lain."
                  : "Gunakan NIM atau nama terakhir yang terdaftar. Jika nama terakhir sama, masuk menggunakan NIM."}
              </p>
            )}
          </div>
        </section>
      </main>
      <audio ref={failureAudio} src="/audio/login-failure.mp3" preload="auto" />
    </div>
  );
}
