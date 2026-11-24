import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | undefined;
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
    clientPromise = readResponse<{ url: string; publishableKey: string }>(
      "/api/auth-config",
    )
      .then((config) =>
        createClient(config.url, config.publishableKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        }),
      )
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
    window.location.replace("/login?status=expired");
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
      await client.auth.signOut({ scope: "local" });
    }
    throw error;
  }
}
