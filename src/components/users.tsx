"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, HttpError } from "@/lib/auth";
import { ADMIN_LOGIN_URL } from "@/lib/access-mode";
import { cachedDirectory, saveDirectory } from "@/lib/dashboard-cache";
import { errorMessage } from "@/lib/data";
import type { DashboardUser, UserRole, UsersResponse } from "@/lib/types";
import { useDashboard } from "./dashboard-provider";
import { Notice, Panel } from "./ui";

const roleLabel = (role: UserRole) =>
  role === "super_admin" ? "Super admin" : "Pengguna";
const pageLabel: Record<string, string> = {
  "/": "Ringkasan",
  "/validasi": "Validasi model",
  "/membership": "Fungsi keanggotaan",
  "/gwo": "Proses GWO",
  "/fis": "Proses FIS Mamdani",
  "/simulasi": "Simulasi baru",
  "/anggota": "Anggota kelompok",
  "/motto": "Motto",
  "/pengguna": "Kelola pengguna",
};
function loginDuration(start: string | null, now: number) {
  if (!start) return "Belum tercatat";
  const seconds = Math.max(0, Math.floor((now - Date.parse(start)) / 1000));
  if (!Number.isFinite(seconds)) return "Belum tercatat";
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours} jam ${minutes} mnt`
    : `${minutes} mnt ${seconds % 60} dtk`;
}
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function UsersView() {
  const { info, refreshIdentity } = useDashboard();
  const owner = info?.identity.id || "";
  const [result, setResult] = useState<UsersResponse | null>(
    () => cachedDirectory(owner) || null,
  );
  const [loading, setLoading] = useState(() => !cachedDirectory(owner));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [editing, setEditing] = useState<DashboardUser | null>(null);
  const [role, setRole] = useState<UserRole>("member");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<DashboardUser | null>(null);
  const editor = useRef<HTMLFormElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const kickConfirm = useRef<HTMLButtonElement>(null);
  const isAdmin = info?.identity.role === "super_admin";
  const remember = useCallback(
    (response: UsersResponse) => {
      if (response.server_time)
        setServerOffset(Date.parse(response.server_time) - Date.now());
      saveDirectory(owner, response);
      setResult(response);
    },
    [owner],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      remember(await api<UsersResponse>("/api/admin-users"));
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof HttpError && failure.status === 403) {
        setResult(null);
        void refreshIdentity();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshIdentity, remember]);
  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    api<UsersResponse>("/api/admin-users", { signal: controller.signal })
      .then(remember)
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(failure));
        if (failure instanceof HttpError && failure.status === 403)
          void refreshIdentity();
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, refreshIdentity, remember]);
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    let pending = false;
    const interval = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await api<UsersResponse>("/api/admin-users", {
          signal: controller.signal,
        });
        remember(response);
      } catch (failure) {
        if (failure instanceof HttpError && failure.status === 403) {
          setResult(null);
          void refreshIdentity();
        }
      } finally {
        pending = false;
      }
    }, 15000);
    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [isAdmin, refreshIdentity, remember]);
  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (kickTarget) kickConfirm.current?.focus();
  }, [kickTarget]);

  if (!isAdmin)
    return (
      <Notice>
        Halaman ini hanya tersedia untuk super admin. Anda tetap bisa
        menjalankan simulasi dan mengunduh hasil eksperimen.
        {info?.identity.role === "guest" && (
          <Link className="button button-primary" href={ADMIN_LOGIN_URL}>
            Masuk admin
          </Link>
        )}
        <Link className="button button-secondary" href="/">
          Kembali ke ringkasan
        </Link>
      </Notice>
    );

  const users = result?.users ?? [];
  const matching = users.filter(
    (user) =>
      `${user.name} ${user.login_id}`
        .toLocaleLowerCase("id")
        .includes(query.trim().toLocaleLowerCase("id")) &&
      (filter === "all" ||
        (filter === "online"
          ? user.logged_in
          : filter === "offline"
            ? !user.logged_in
            : filter === "inactive"
              ? !user.active
              : user.role === filter)),
  );
  const isSelf = editing?.id === info?.identity.id;
  const changed =
    editing && (role !== editing.role || active !== editing.active);

  function edit(user: DashboardUser, trigger: HTMLButtonElement) {
    setKickTarget(null);
    editTrigger.current = trigger;
    setEditing(user);
    setRole(user.role);
    setActive(user.active);
    setError("");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !changed || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          role,
          active,
          updated_at: editing.updated_at,
        }),
      });
      setMessage(`Akses ${editing.name} berhasil diperbarui.`);
      setEditing(null);
      await load();
      editTrigger.current?.focus();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof HttpError && failure.status === 403) {
        setResult(null);
        setEditing(null);
        void refreshIdentity();
      }
    } finally {
      setSaving(false);
    }
  }

  async function kick() {
    if (!kickTarget || kicking) return;
    setKicking(kickTarget.id);
    setError("");
    setMessage("");
    try {
      const response = await api<{ message: string }>("/api/admin-kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kickTarget.id }),
      });
      setMessage(response.message);
      setKickTarget(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setKicking(null);
    }
  }

  return (
    <>
      <p className="admin-access-note">
        Semua pengguna dapat menjalankan simulasi dan mengunduh data. Super
        admin juga dapat mengelola peran serta mengaktifkan atau menonaktifkan
        akses akun. Status login diperbarui otomatis; koneksi yang tidak
        terdeteksi selama 90 detik tampil sebagai Tidak login. Kick mengakhiri
        sesi tanpa memblokir akun. Durasi dihitung dari sesi aktif paling awal;
        halaman menunjukkan aktivitas terakhir dan diperbarui berkala.
      </p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {kickTarget && (
        <Panel title={`Kick ${kickTarget.name}?`}>
          <p className="admin-edit-help">
            Semua sesi dashboard member ini akan diakhiri. Mereka akan melihat
            stiker bercanda dan tetap bisa login kembali.
          </p>
          <div className="admin-form-actions">
            <button
              ref={kickConfirm}
              className="button button-danger"
              disabled={kicking !== null}
              onClick={() => {
                void kick();
              }}
            >
              {kicking ? "Mengakhiri sesi…" : "Ya, kick member"}
            </button>
            <button
              className="button button-secondary"
              disabled={kicking !== null}
              onClick={() => {
                setKickTarget(null);
                editTrigger.current?.focus();
              }}
            >
              Batal kick
            </button>
          </div>
        </Panel>
      )}
      {editing && (
        <Panel title={`Atur akses: ${editing.name}`}>
          <form
            ref={editor}
            tabIndex={-1}
            className="admin-edit-form"
            onSubmit={save}
            aria-busy={saving}
          >
            <div className="admin-edit-fields">
              <label>
                Peran
                <select
                  className="field-input"
                  value={role}
                  disabled={saving || isSelf}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="member">Pengguna</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </label>
              <label>
                Status akses
                <select
                  className="field-input"
                  value={active ? "active" : "inactive"}
                  disabled={saving || isSelf}
                  onChange={(e) => setActive(e.target.value === "active")}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </label>
            </div>
            <p className="admin-edit-help">
              {isSelf
                ? "Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri."
                : !active
                  ? "Akun ini akan kehilangan akses dashboard, termasuk sesi yang sedang berjalan."
                  : role === "super_admin"
                    ? "Akun ini dapat mengubah peran dan status akses pengguna lain."
                    : "Akun ini dapat membaca analisis, menjalankan simulasi, dan mengunduh data."}
            </p>
            <div className="admin-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={!changed || saving || isSelf}
              >
                {saving ? "Menyimpan…" : "Simpan akses"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  editTrigger.current?.focus();
                }}
              >
                Batal
              </button>
            </div>
          </form>
        </Panel>
      )}
      <Panel
        title="Akun terdaftar"
        action={
          <button
            className="button button-secondary"
            disabled={loading || saving || kicking !== null}
            onClick={() => {
              setEditing(null);
              void load();
            }}
          >
            Muat ulang
          </button>
        }
      >
        <div className="admin-toolbar">
          <label className="admin-search">
            Cari nama atau NIM
            <input
              type="search"
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama atau NIM pengguna"
            />
          </label>
          <label>
            Filter akun
            <select
              className="field-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Semua akun</option>
              <option value="super_admin">Super admin</option>
              <option value="member">Pengguna</option>
              <option value="online">Sedang login</option>
              <option value="offline">Tidak login</option>
              <option value="inactive">Akses nonaktif</option>
            </select>
          </label>
        </div>
        <p className="admin-result-count" role="status">
          {loading
            ? "Memuat daftar pengguna…"
            : result
              ? `${matching.length} dari ${users.length} akun · ${users.filter((u) => u.logged_in).length} sedang login`
              : "Daftar pengguna belum dapat dimuat. Pilih Muat ulang untuk mencoba lagi."}
        </p>
        {result && (
          <div className="table-wrap admin-user-table" aria-busy={loading}>
            <table className="data-table">
              <caption className="sr-only">
                Daftar akun dashboard, peran, dan status login
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pengguna</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Status login</th>
                  <th scope="col">Durasi login</th>
                  <th scope="col">Halaman saat ini</th>
                  <th scope="col">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {matching.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <span className="admin-user-name">
                        {user.name}
                        {user.id === info?.identity.id && (
                          <span className="admin-you"> (Anda)</span>
                        )}
                      </span>
                      <span className="admin-user-id">{user.login_id}</span>
                      {!user.active && (
                        <span className="admin-user-id">
                          Akses dinonaktifkan
                        </span>
                      )}
                    </th>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <span
                        className={`admin-status ${user.logged_in ? "is-active" : "is-offline"}`}
                      >
                        {user.logged_in ? "Sedang login" : "Tidak login"}
                      </span>
                    </td>
                    <td className="admin-duration">
                      {user.logged_in
                        ? loginDuration(
                            user.login_started_at,
                            clock + serverOffset,
                          )
                        : "Tidak ada sesi"}
                    </td>
                    <td className="admin-current-page">
                      {user.logged_in ? (
                        <>
                          <span>
                            {pageLabel[user.current_page || ""] ||
                              "Menunggu aktivitas halaman"}
                          </span>
                          {user.session_count > 1 && (
                            <small>{user.session_count} sesi aktif</small>
                          )}
                        </>
                      ) : (
                        "Tidak ada sesi"
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="button button-quiet"
                          disabled={saving || kicking !== null}
                          aria-label={`Atur akses ${user.name}`}
                          aria-expanded={editing?.id === user.id}
                          onClick={(event) => edit(user, event.currentTarget)}
                        >
                          Atur akses
                        </button>
                        {user.role === "member" && user.logged_in && (
                          <button
                            className="button button-danger"
                            disabled={saving || kicking !== null}
                            aria-label={`Kick ${user.name}`}
                            onClick={(event) => {
                              editTrigger.current = event.currentTarget;
                              setKickTarget(user);
                              setEditing(null);
                              setError("");
                              setMessage("");
                            }}
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!matching.length && (
              <p className="table-footnote">
                Tidak ada akun yang cocok. Ubah kata pencarian atau filter.
              </p>
            )}
          </div>
        )}
      </Panel>
      <Panel
        title="Riwayat perubahan akses"
        caption="20 perubahan terbaru. Setiap perubahan menyimpan nama admin, akun yang diubah, dan waktu penyimpanan."
      >
        {!result ? (
          <p className="table-footnote">
            {loading ? "Memuat riwayat…" : "Riwayat belum dapat dimuat."}
          </p>
        ) : !result.activity.length ? (
          <p className="table-footnote">
            Belum ada perubahan akses yang tercatat.
          </p>
        ) : (
          <ol className="admin-activity">
            {result.activity.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.target_name}</strong>
                  <p>
                    {entry.action === "session_kicked" &&
                      "Sesi dashboard dikeluarkan. "}
                    {entry.old_role !== entry.new_role &&
                      `Peran: ${roleLabel(entry.old_role)} → ${roleLabel(entry.new_role)}. `}
                    {entry.old_active !== entry.new_active &&
                      `Akses ${entry.new_active ? "diaktifkan" : "dinonaktifkan"}. `}
                    Oleh {entry.actor_name}.
                  </p>
                </div>
                <time dateTime={entry.created_at}>
                  {timestamp(entry.created_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
