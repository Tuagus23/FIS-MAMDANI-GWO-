"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  api,
  getAuthClient,
  redirectToLogin,
  redirectAfterSignOut,
} from "@/lib/auth";
import { ADMIN_LOGIN_URL, PUBLIC_DASHBOARD } from "@/lib/access-mode";
import { errorMessage } from "@/lib/data";
import {
  cachedDataset,
  forgetDataset,
  loadBootstrap,
  loadDataset,
  PUBLIC_SCOPE,
  sessionScope,
} from "@/lib/dashboard-cache";
import type {
  DashboardData,
  DatasetsResponse,
  SimulationResult,
} from "@/lib/types";
interface ContextValue {
  info: DatasetsResponse | null;
  refreshIdentity: () => Promise<void>;
  datasetId: string;
  selectDataset: (id: string) => void;
  data: DashboardData | null;
  loading: boolean;
  error: string;
  retry: () => void;
  simulation: SimulationResult | null;
  saveSimulation: (value: SimulationResult) => void;
}
const Context = createContext<ContextValue | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<DatasetsResponse | null>(null);
  const [datasetId, selectDataset] = useState("results");
  const [scope, setScope] = useState("");
  const [result, setResult] = useState<{
    data: DashboardData | null;
    error: string;
    id: string;
  }>({ data: null, error: "", id: "" });
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [simulation, saveSimulation] = useState<SimulationResult | null>(null);
  const identityRequest = useRef<Promise<void> | null>(null);
  const identityPage = useRef("");
  const pathname = usePathname();
  const authenticated = info !== null && info.identity.role !== "guest";
  const refreshIdentity = useCallback(function refresh(): Promise<void> {
    if (identityRequest.current)
      return identityRequest.current.then(() => {
        if (identityPage.current !== window.location.pathname) return refresh();
      });
    identityPage.current = window.location.pathname;
    const request = api<Pick<DatasetsResponse, "identity">>(
      `/api/session?page=${encodeURIComponent(identityPage.current)}`,
    )
      .then(({ identity }) => {
        setAuthError("");
        setInfo((current) =>
          current &&
          current.identity.role === identity.role &&
          current.identity.id === identity.id &&
          current.identity.name === identity.name
            ? current
            : current
              ? { ...current, identity }
              : current,
        );
      })
      .catch((failure) => {
        setAuthError(errorMessage(failure));
      })
      .finally(() => {
        identityRequest.current = null;
      });
    identityRequest.current = request;
    return request;
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      void refreshIdentity();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [authenticated, refreshIdentity]);
  useEffect(() => {
    if (authenticated) void refreshIdentity();
  }, [authenticated, pathname, refreshIdentity]);
  useEffect(() => {
    if (!authenticated) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshIdentity();
    }, 20000);
    const resume = () => {
      if (document.visibilityState === "visible") void refreshIdentity();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [authenticated, refreshIdentity]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getAuthClient()
      .then(async (client) => {
        const { data } = await client.auth.getSession();
        if (!data.session && !PUBLIC_DASHBOARD) {
          redirectToLogin();
          return;
        }
        if (
          new URLSearchParams(location.hash.slice(1)).get("type") === "invite"
        ) {
          window.location.replace(`${ADMIN_LOGIN_URL}${location.hash}`);
          return;
        }
        const datasets = await loadBootstrap(data.session);
        if (!active) return;
        setInfo(datasets);
        setScope(data.session ? sessionScope(data.session) : PUBLIC_SCOPE);
        setResult({
          data: datasets.data,
          error: datasets.data_error || "",
          id: datasets.default,
        });
        const { data: listener } = client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") redirectAfterSignOut();
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      })
      .catch((error) => {
        if (!active) return;
        if (!PUBLIC_DASHBOARD) {
          setAuthError(errorMessage(error));
          return;
        }
        loadBootstrap(null)
          .then((datasets) => {
            if (!active) return;
            setInfo(datasets);
            setScope(PUBLIC_SCOPE);
            setResult({
              data: datasets.data,
              error: datasets.data_error || "",
              id: datasets.default,
            });
          })
          .catch((failure) => {
            if (active) setAuthError(errorMessage(failure));
          });
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (
      !scope ||
      cachedDataset(scope, datasetId) ||
      (result.id === datasetId && result.error)
    )
      return;
    let active = true;
    loadDataset(scope, datasetId)
      .then((data) => {
        if (active) setResult({ data, error: "", id: datasetId });
      })
      .catch((error) => {
        if (active)
          setResult({ data: null, error: errorMessage(error), id: datasetId });
      });
    return () => {
      active = false;
    };
  }, [scope, datasetId, attempt, result.id, result.error]);
  const retry = () => {
    forgetDataset(scope, datasetId);
    setResult({ data: null, error: "", id: "" });
    setAttempt((value) => value + 1);
  };
  if (!info)
    return (
      <div className="auth-gate" role="status">
        <span>
          {authError ||
            (PUBLIC_DASHBOARD
              ? "Membuka dashboard…"
              : "Memeriksa sesi dan izin akses…")}
        </span>
        {authError && <Link href={ADMIN_LOGIN_URL}>Masuk admin</Link>}
      </div>
    );
  const current = result.id === datasetId;
  const data =
    cachedDataset(scope, datasetId) || (current ? result.data : null);
  return (
    <Context
      value={{
        info,
        refreshIdentity,
        datasetId,
        selectDataset,
        data,
        error: current && !data ? result.error : "",
        loading: !data && !current,
        retry,
        simulation:
          simulation?.config.dataset_id === datasetId ? simulation : null,
        saveSimulation,
      }}
    >
      {children}
    </Context>
  );
}
export function useDashboard() {
  const context = useContext(Context);
  if (!context) throw new Error("DashboardProvider diperlukan.");
  return context;
}
