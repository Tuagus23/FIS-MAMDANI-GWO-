"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { BrandMark } from "./brand-mark";
import { NavIcon } from "./nav-icon";
import { useDashboard } from "./dashboard-provider";
import { getAuthClient } from "@/lib/auth";
import { milestone, views, viewPath } from "@/lib/data";
import { downloadCsv } from "@/lib/download";
import { Notice } from "./ui";
import type { View } from "@/lib/types";
import { MotionLayer } from "./motion-layer";

const groups: { label: string; items: View[] }[] = [
  { label: "Analisis", items: ["hasil", "validasi", "membership"] },
  { label: "Eksplorasi", items: ["gwo", "fis", "simulasi"] },
  { label: "Kelompok", items: ["anggota", "motto"] },
];
function markNavigation(event: MouseEvent<HTMLAnchorElement>) {
  document.documentElement.dataset.inputMode =
    event.detail === 0 ? "keyboard" : "pointer";
}
export function DashboardShell({ children }: { children: ReactNode }) {
  const { info, data, datasetId, selectDataset, error, loading, retry } =
    useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const view: View = Object.hasOwn(views, pathname.slice(1))
    ? (pathname.slice(1) as View)
    : "hasil";
  const personalPage = view === "anggota" || view === "motto";
  const name = info?.identity.name || "Akun";
  const words = name.split(/\s+/).filter(Boolean);
  const initials = `${words[0]?.[0] || ""}${words.length > 1 ? words[words.length - 1][0] : ""}`;
  const status = loading
    ? "Memuat data"
    : error
      ? "Koneksi bermasalah"
      : "Terhubung";
  useEffect(() => {
    const routeHash = () => {
      const hash = location.hash.slice(1);
      if (Object.hasOwn(views, hash)) router.replace(viewPath(hash as View));
    };
    routeHash();
    window.addEventListener("hashchange", routeHash);
    return () => window.removeEventListener("hashchange", routeHash);
  }, [router]);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) {
      nav.scrollTo({
        left: active.offsetLeft - nav.offsetLeft - 16,
        behavior: "instant",
      });
    }
  }, [pathname]);
  const navigation = (items: View[], mobile = false) =>
    items.map((key) => (
      <Link
        href={viewPath(key)}
        key={key}
        onClick={markNavigation}
        className={`${mobile ? "mobile-nav-link" : "nav-link"} ${view === key ? "is-active" : ""}`}
        aria-current={view === key ? "page" : undefined}
      >
        {!mobile && <NavIcon view={key} />}
        <span>{key === "motto" ? "Motto" : views[key].title}</span>
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
      <div id="dashboardApp" className="dashboard-layout">
        <aside className="sidebar dashboard-sidebar">
          <Link
            className="brand sidebar-brand"
            href="/"
            onClick={markNavigation}
          >
            <BrandMark />
            <span>
              <strong>Fuzzy CH WSN</strong>
              <span>Ruang analisis simulasi</span>
            </span>
          </Link>
          <nav className="sidebar-navigation" aria-label="Navigasi utama">
            {groups.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="sidebar-label">{group.label}</p>
                {navigation(group.items)}
              </div>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="sidebar-note-mark" aria-hidden="true" />
            <p>Kelompok 3</p>
            <p>Pengantar Komputasi Lunak</p>
          </div>
        </aside>
        <main id="mainContent" tabIndex={-1} className="dashboard-main">
          <header className="topbar dashboard-topbar">
            <div className="topbar-row">
              <Link
                className="brand mobile-brand"
                href="/"
                onClick={markNavigation}
              >
                <BrandMark />
                <span>Fuzzy CH WSN</span>
              </Link>
              <nav className="breadcrumb" aria-label="Lokasi halaman">
                <span>Ruang analisis</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="m6 4 4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span aria-current="page">{views[view].title}</span>
              </nav>
              <div className="account-controls">
                <span
                  className={`connection-state ${error ? "is-error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className={`connection-dot ${loading ? "is-loading" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="connection-label">{status}</span>
                </span>
                <div className="account-identity" title={name}>
                  <span className="account-initials" aria-hidden="true">
                    {initials}
                  </span>
                  <div>
                    <span
                      className="account-email"
                      aria-label={`Akun aktif: ${name}`}
                    >
                      {name}
                    </span>
                    <span className="account-role">
                      {info?.identity.role === "super_admin"
                        ? "Dosen · administrator"
                        : "Anggota kelompok"}
                    </span>
                  </div>
                </div>
                <button
                  className="button button-quiet logout-button"
                  disabled={leaving}
                  aria-label="Keluar dari akun"
                  onClick={async () => {
                    setLeaving(true);
                    setLogoutError("");
                    try {
                      const { error } = await (
                        await getAuthClient()
                      ).auth.signOut({ scope: "local" });
                      if (error) throw error;
                      window.location.replace("/login");
                    } catch {
                      setLeaving(false);
                      setLogoutError(
                        "Belum dapat keluar. Periksa koneksi lalu coba lagi.",
                      );
                    }
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M8 3H4v14h4m4-11 4 4-4 4m-5-4h9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{leaving ? "Keluar…" : "Keluar"}</span>
                </button>
              </div>
            </div>
            <nav className="mobile-nav" aria-label="Navigasi halaman">
              {navigation(
                groups.flatMap((group) => group.items),
                true,
              )}
            </nav>
          </header>
          <div className="page-wrap dashboard-content">
            <div className="page-heading">
              <div>
                <h1 id="pageTitle">{views[view].title}</h1>
                <p className="page-description">{views[view].description}</p>
              </div>
              {view === "hasil" && (
                <button
                  className="button button-secondary export-button"
                  disabled={!data?.summary.length || loading}
                  onClick={exportSummary}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Unduh CSV
                </button>
              )}
            </div>
            {!personalPage && (
              <section className="dataset-toolbar" aria-label="Dataset aktif">
                <div className="dataset-picker">
                  <label htmlFor="datasetSelect">Dataset eksperimen</label>
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
                </div>
                <p className="dataset-description">
                  {data?.dataset.description ||
                    (loading
                      ? "Menyiapkan data untuk eksperimen terpilih…"
                      : "Pilih dataset untuk menampilkan hasil.")}
                </p>
              </section>
            )}
            {logoutError && <Notice error>{logoutError}</Notice>}
            {error && (
              <Notice error>
                {error}
                <button className="button button-quiet" onClick={retry}>
                  Coba lagi
                </button>
              </Notice>
            )}
            {loading && !personalPage && (
              <p className="loading-label" role="status">
                <span className="loading-indicator" aria-hidden="true" />
                Memuat data eksperimen…
              </p>
            )}
            {children}
            <footer className="page-footer">
              <p>
                Model simulasi untuk perbandingan protokol jaringan sensor.
                Hasil simulasi tidak menjamin kinerja pada jaringan nyata.
              </p>
              <p>Mamdani · LEACH · Grey Wolf Optimizer</p>
            </footer>
          </div>
        </main>
      </div>
      <MotionLayer route={pathname} />
    </>
  );
}
