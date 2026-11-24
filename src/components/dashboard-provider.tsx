"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { api, getAuthClient } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
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
  const [result, setResult] = useState<{
    data: DashboardData | null;
    error: string;
    id: string;
  }>({ data: null, error: "", id: "" });
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [simulation, saveSimulation] = useState<SimulationResult | null>(null);
  const refreshIdentity = useCallback(async () => {
    try {
      const response = await api<DatasetsResponse>("/api/datasets");
      setInfo((current) =>
        current?.identity.role === response.identity.role &&
        current.identity.id === response.identity.id
          ? current
          : response,
      );
    } catch (failure) {
      setAuthError(errorMessage(failure));
    }
  }, []);
  useEffect(() => {
    const refresh = () => {
      void refreshIdentity();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refreshIdentity]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getAuthClient()
      .then(async (client) => {
        const { data } = await client.auth.getSession();
        if (!data.session) {
          window.location.replace("/login");
          return;
        }
        if (
          new URLSearchParams(location.hash.slice(1)).get("type") === "invite"
        ) {
          window.location.replace(`/login${location.hash}`);
          return;
        }
        const datasets = await api<DatasetsResponse>("/api/datasets");
        if (!active) return;
        setInfo(datasets);
        const { data: listener } = client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") window.location.replace("/login");
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      })
      .catch((error) => {
        if (active) setAuthError(errorMessage(error));
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!info) return;
    let active = true;
    const controller = new AbortController();
    api<DashboardData>(
      `/api/dashboard?dataset=${encodeURIComponent(datasetId)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (
          data.dataset?.id !== datasetId ||
          !Array.isArray(data.summary) ||
          !Array.isArray(data.history)
        )
          throw new Error("Data server tidak sesuai dataset yang dipilih.");
        if (active) setResult({ data, error: "", id: datasetId });
      })
      .catch((error) => {
        if (active)
          setResult({ data: null, error: errorMessage(error), id: datasetId });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [info, datasetId, attempt]);
  const retry = () => {
    setResult({ data: null, error: "", id: "" });
    setAttempt((value) => value + 1);
  };
  if (!info)
    return (
      <div className="auth-gate" role="status">
        <span>{authError || "Memeriksa sesi dan izin akses…"}</span>
        {authError && <Link href="/login">Masuk kembali</Link>}
      </div>
    );
  const current = result.id === datasetId;
  return (
    <Context
      value={{
        info,
        refreshIdentity,
        datasetId,
        selectDataset,
        data: current ? result.data : null,
        error: current ? result.error : "",
        loading: !current,
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
