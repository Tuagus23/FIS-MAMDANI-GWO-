import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isCurrentSession } from "./session-scope";
import { PUBLIC_DASHBOARD } from "./access-mode";

let clientPromise: Promise<SupabaseClient> | undefined;
const sessionCleanup = new Set<() => void>();
let redirectingToLogin = false;
export function redirectAfterSignOut() {
  if (!PUBLIC_DASHBOARD) return redirectToLogin();
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  window.location.replace("/");
}
export function redirectToLogin(status?: "expired" | "kicked") {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  const reason = sessionStorage.getItem("dashboard:kicked") ? "kicked" : status;
  window.location.replace(reason ? `/login?status=${reason}` : "/login");
}
export function onSessionEnded(callback: () => void) {
  sessionCleanup.add(callback);
}

async function authConfiguration() {
  const embedded = document.getElementById(
    "dashboard-auth-config",
  )?.textContent;
  if (embedded) {
    try {
      const config = JSON.parse(embedded);
      if (
        typeof config.url === "string" &&
        typeof config.publishableKey === "string"
      )
        return config as { url: string; publishableKey: string };
    } catch {}
  }
  return readResponse<{ url: string; publishableKey: string }>(
    "/api/auth-config",
  );
}
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export function getAuthClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = authConfiguration()
      .then((config) => {
        const client = createClient(config.url, config.publishableKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        });
        client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT")
            for (const clear of sessionCleanup) clear();
        });
        return client;
      })
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}
export async function readResponse<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(65000),
    ...options,
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    const message =
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : null;
    throw new HttpError(
      message ||
        ([504, 502, 503].includes(response.status)
          ? "Server terlalu lama merespons. Coba lagi sebentar."
          : "Server tidak dapat memuat data. Coba lagi sebentar."),
      response.status,
      result &&
        typeof result === "object" &&
        "code" in result &&
        typeof result.code === "string"
        ? result.code
        : undefined,
    );
  }
  return result as T;
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const client = await getAuthClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    redirectToLogin("expired");
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  const headers = new Headers(options?.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  try {
    return await readResponse<T>(url, { ...options, headers });
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 401 || error.code === "access_revoked")
    ) {
      const { data: latest } = await client.auth.getSession();
      if (!isCurrentSession(data.session, latest.session)) throw error;
    }
    if (error instanceof HttpError && error.code === "session_kicked") {
      sessionStorage.setItem("dashboard:kicked", "1");
      await client.auth.signOut({ scope: "local" });
      redirectToLogin("kicked");
      throw error;
    }
    if (
      error instanceof HttpError &&
      (error.status === 401 || error.code === "access_revoked")
    ) {
      await client.auth.signOut({ scope: "local" });
    }
    throw error;
  }
}

export async function signOutDashboard() {
  const client = await getAuthClient();
  try {
    await api("/api/session", { method: "POST" });
  } finally {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  }
}
