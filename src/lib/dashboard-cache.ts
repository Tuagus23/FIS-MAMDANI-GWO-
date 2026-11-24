import type { Session } from "@supabase/supabase-js";
import { api, onSessionEnded, readResponse } from "./auth";
import type {
  BootstrapResponse,
  DashboardData,
  GwoData,
  UsersResponse,
} from "./types";
import { ResourceCache } from "./resource-cache";

const bootstraps = new ResourceCache<BootstrapResponse>(15000);
const datasets = new ResourceCache<DashboardData>();
const directories = new ResourceCache<UsersResponse>(60000);
const gwo = new ResourceCache<GwoData>();

onSessionEnded(() => {
  bootstraps.clear();
  datasets.clear();
  directories.clear();
});

export function sessionScope(session: Session): string {
  // This partitions in-memory data only. Authorization is always checked by the API.
  try {
    const payload = JSON.parse(
      atob(
        session.access_token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
    );
    if (typeof payload.session_id === "string")
      return `${session.user.id}:${payload.session_id}`;
  } catch {}
  return `${session.user.id}:${session.access_token}`;
}

function checkedDataset(value: DashboardData, id: string) {
  if (
    value?.dataset?.id !== id ||
    !Array.isArray(value.summary) ||
    !Array.isArray(value.history)
  ) {
    throw new Error("Data server tidak sesuai dataset yang dipilih.");
  }
  return value;
}

export async function loadBootstrap(session: Session) {
  const scope = sessionScope(session);
  const response = await bootstraps.load(scope, () =>
    api<BootstrapResponse>("/api/bootstrap"),
  );
  if (response.identity.id !== session.user.id)
    throw new Error("Identitas sesi tidak sesuai. Silakan masuk kembali.");
  if (response.data)
    datasets.seed(
      `${scope}:${response.default}`,
      checkedDataset(response.data, response.default),
    );
  return response;
}

export const cachedDataset = (scope: string, id: string) =>
  datasets.peek(`${scope}:${id}`);
export const forgetDataset = (scope: string, id: string) =>
  datasets.delete(`${scope}:${id}`);
export function loadDataset(scope: string, id: string) {
  return datasets.load(`${scope}:${id}`, async () =>
    checkedDataset(
      await api<DashboardData>(
        `/api/dashboard?dataset=${encodeURIComponent(id)}`,
      ),
      id,
    ),
  );
}
export const cachedDirectory = (owner: string) => directories.peek(owner);
export function saveDirectory(owner: string, response: UsersResponse) {
  directories.seed(owner, response);
}
export const cachedGwo = () => gwo.peek("saved");
export const loadGwo = () =>
  gwo.load("saved", () =>
    readResponse<GwoData>("/gwo-process-data.json", { cache: "force-cache" }),
  );
