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
import { errorMessage } from "@/lib/data";
import type { DashboardUser, UserRole, UsersResponse } from "@/lib/types";
import { useDashboard } from "./dashboard-provider";
import { Notice, Panel } from "./ui";

const roleLabel = (role: UserRole) =>
  role === "super_admin" ? "Super admin" : "Pengguna";
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function UsersView() {
  const { info, refreshIdentity } = useDashboard();
  const [result, setResult] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<DashboardUser | null>(null);
  const [role, setRole] = useState<UserRole>("member");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLFormElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const isAdmin = info?.identity.role === "super_admin";
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await api<UsersResponse>("/api/admin/users"));
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof HttpError && failure.status === 403) {
        setResult(null);
        void refreshIdentity();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshIdentity]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    api<UsersResponse>("/api/admin/users", { signal: controller.signal })
      .then(setResult)
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
  }, [isAdmin, refreshIdentity]);
  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  if (!isAdmin)
    return (
      <Notice>
        Halaman ini hanya tersedia untuk super admin. Anda tetap bisa
        menjalankan simulasi dan mengunduh hasil eksperimen.
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
        (filter === "inactive" ? !user.active : user.role === filter)),
  );
  const isSelf = editing?.id === info?.identity.id;
  const changed =
    editing && (role !== editing.role || active !== editing.active);

  function edit(user: DashboardUser, trigger: HTMLButtonElement) {
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
      await api("/api/admin/users", {
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

  return (
    <>
      <p className="admin-access-note">
        Semua pengguna dapat menjalankan simulasi dan mengunduh data. Super
        admin juga dapat mengelola peran serta mengaktifkan atau menonaktifkan
        akses akun.
      </p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
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
            disabled={loading || saving}
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
              <option value="inactive">Nonaktif</option>
            </select>
          </label>
        </div>
        <p className="admin-result-count" role="status">
          {loading
            ? "Memuat daftar pengguna…"
            : result
              ? `${matching.length} dari ${users.length} akun · ${users.filter((u) => u.role === "super_admin" && u.active).length} super admin aktif`
              : "Daftar pengguna belum dapat dimuat. Pilih Muat ulang untuk mencoba lagi."}
        </p>
        {result && (
          <div className="table-wrap admin-user-table" aria-busy={loading}>
            <table className="data-table">
              <caption className="sr-only">
                Daftar akun dashboard, peran, dan status akses
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pengguna</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Status</th>
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
                    </th>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <span
                        className={`admin-status ${user.active ? "is-active" : "is-inactive"}`}
                      >
                        {user.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button button-quiet"
                        disabled={saving}
                        aria-label={`Atur akses ${user.name}`}
                        aria-expanded={editing?.id === user.id}
                        onClick={(event) => edit(user, event.currentTarget)}
                      >
                        Atur akses
                      </button>
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
        {!result?.activity.length ? (
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
