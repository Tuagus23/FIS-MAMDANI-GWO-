"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { useDashboard } from "./dashboard-provider";
import { getAuthClient } from "@/lib/auth";
import { milestone, views, viewPath } from "@/lib/data";
import { downloadCsv } from "@/lib/download";
import { Notice } from "./ui";
import type { View } from "@/lib/types";
import { MotionLayer } from "./motion-layer";
export function DashboardShell({ children }: { children: ReactNode }) {
  const { info, data, datasetId, selectDataset, error, loading, retry } =
    useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const view: View =
    pathname.slice(1) in views ? (pathname.slice(1) as View) : "hasil";
  useEffect(() => {
    const routeHash = () => {
      const hash = location.hash.slice(1);
      if (hash in views) router.replace(viewPath(hash as View));
    };
    routeHash();
    window.addEventListener("hashchange", routeHash);
    return () => window.removeEventListener("hashchange", routeHash);
  }, [router]);
  const navigation = (mobile: boolean) =>
    Object.entries(views).map(([key, item]) => (
      <Link
        href={viewPath(key as View)}
        key={key}
        className={`${mobile ? "mobile-nav-link" : "nav-link"} ${view === key ? "is-active" : ""}`}
        aria-current={view === key ? "page" : undefined}
      >
        {!mobile && <NavIcon view={key as View} />}
        <span>{key === "motto" ? "Motto" : item.title}</span>
      </Link>
    ));
  const exportSummary = () => {
    if (!data) return;
    downloadCsv(
      `ringkasan_protokol_${datasetId}.csv`,
      [
        "Dataset",
        "Protokol",
        "FND (ronde)",
        "HND (ronde)",
        "LND (ronde)",
        "PDR (%)",
        "Ronde akhir",
      ],
      data.summary.map((row) => [
        data.dataset.label,
        row.protocol,
        row.fnd ?? milestone(row.fnd, data.horizon),
        row.hnd ?? milestone(row.hnd, data.horizon),
        row.lnd ?? milestone(row.lnd, data.horizon),
        row.pdr_total_pct,
        row.last_round,
      ]),
    );
  };
  return (
    <>
      <a className="skip-link" href="#mainContent">
        Lewati ke konten
      </a>
      <div id="dashboardApp" className="min-h-screen lg:flex">
        <aside className="sidebar hidden w-64 shrink-0 flex-col justify-between bg-ink px-5 py-6 text-white lg:flex">
          <div>
            <Link className="brand flex items-center gap-3" href="/">
              <BrandMark />
              <span>
                <span className="block text-sm font-semibold">
                  Fuzzy CH WSN
                </span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Ruang analisis simulasi
                </span>
              </span>
            </Link>
            <div className="mt-10">
              <p className="sidebar-label">Navigasi</p>
              <nav className="mt-3 space-y-1" aria-label="Navigasi utama">
                {navigation(false)}
              </nav>
            </div>
          </div>
          <div className="sidebar-note">
            <span className="sidebar-note-mark" aria-hidden="true" />
            <p>{data?.dataset.label || "Eksperimen utama"}</p>
            <p className="mt-1 text-xs text-white/55">FUZZY · LEACH · GWO</p>
          </div>
        </aside>
        <main id="mainContent" tabIndex={-1} className="min-w-0 flex-1">
          <header className="topbar border-b border-ink/10 bg-white/80 px-4 py-3 sm:px-7 lg:px-10">
            <div className="flex min-h-10 items-center justify-between gap-4">
              <Link
                className="brand flex items-center gap-2.5 lg:hidden"
                href="/"
              >
                <BrandMark />
                <span className="text-sm font-semibold">Fuzzy CH WSN</span>
              </Link>
              <p className="hidden text-sm font-medium text-slate-600 sm:block">
                Ruang analisis <span className="mx-1 text-slate-300">/</span>{" "}
                <span className="text-ink">{views[view].title}</span>
              </p>
              <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
                <label className="sr-only" htmlFor="datasetSelect">
                  Pilih dataset
                </label>
                <select
                  id="datasetSelect"
                  className="dataset-select"
                  value={datasetId}
                  onChange={(e) => selectDataset(e.target.value)}
                >
                  {info?.datasets.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span
                  className={`connection-state ${error ? "is-error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="connection-dot" aria-hidden="true" />
                  <span>
                    {loading
                      ? "Memuat"
                      : error
                        ? "Data tidak tersedia"
                        : "Terhubung"}
                  </span>
                </span>
                <span className="account-email" aria-label="Akun aktif">
                  {info?.identity.name}
                </span>
                <button
                  className="button button-quiet"
                  disabled={leaving}
                  onClick={async () => {
                    setLeaving(true);
                    try {
                      await (
                        await getAuthClient()
                      ).auth.signOut({ scope: "local" });
                      window.location.replace("/login");
                    } catch {
                      setLeaving(false);
                    }
                  }}
                >
                  Keluar
                </button>
              </div>
            </div>
            <nav
              className="mobile-nav mt-3 flex gap-1 overflow-x-auto lg:hidden"
              aria-label="Navigasi halaman"
            >
              {navigation(true)}
            </nav>
          </header>
          <div className="page-wrap mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-11">
            <div className="page-heading mb-7 sm:mb-9">
              <div>
                <h1
                  id="pageTitle"
                  className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                >
                  {views[view].title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {views[view].description}
                </p>
                {!["anggota", "motto"].includes(view) && (
                  <p className="dataset-description mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    {data?.dataset.description}
                  </p>
                )}
              </div>
              {view === "hasil" && (
                <button
                  className="button button-secondary"
                  disabled={!data?.summary.length || loading}
                  onClick={exportSummary}
                >
                  Unduh ringkasan CSV
                </button>
              )}
            </div>
            {error && (
              <Notice error>
                {error}{" "}
                <button className="button button-quiet" onClick={retry}>
                  Coba lagi
                </button>
              </Notice>
            )}
            {loading && !["anggota", "motto"].includes(view) && (
              <Notice>Memuat data eksperimen…</Notice>
            )}
            {children}
            <footer className="page-footer mt-10 border-t border-ink/10 pt-5">
              <p>
                Model simulasi untuk pembandingan protokol jaringan sensor.
                Hasil simulasi tidak menjamin kinerja pada jaringan nyata.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Mamdani · LEACH · Grey Wolf Optimizer
              </p>
            </footer>
          </div>
        </main>
      </div>
      <MotionLayer route={pathname} />
    </>
  );
}
function NavIcon({ view }: { view: View }) {
  const paths: Record<View, string> = {
    hasil: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z",
    validasi: "M10 2 17 5v5c0 4-4 7-7 8-3-1-7-4-7-8V5zM6 10l3 3 5-6",
    membership: "M2 16c3 0 3-12 7-12s3 12 7 12 2-4 2-4",
    gwo: "M4 5h12M4 5l6 11 6-11M2 3h4v4H2zM14 3h4v4h-4zM8 14h4v4H8z",
    fis: "M2 2h5v5H2zM13 2h5v5h-5zM7 13h6v5H7zM4 7v3h12V7M10 10v3",
    anggota:
      "M7 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 17c0-6 10-6 10 0M14 3c4 0 4 6 0 6M14 12c3 0 4 3 4 5",
    motto:
      "M3 5h5v5c0 3-2 5-5 5v-2c2 0 3-1 3-3H3zM12 5h5v5c0 3-2 5-5 5v-2c2 0 3-1 3-3h-3z",
    simulasi: "M7 5l8 5-8 5zM10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16",
  };
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[view]} />
    </svg>
  );
}
