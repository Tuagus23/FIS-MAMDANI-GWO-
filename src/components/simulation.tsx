"use client";
import { useEffect, useRef, useState } from "react";
import type {
  DashboardData,
  SimulationConfig,
  SimulationResult,
} from "@/lib/types";
import { api, readResponse } from "@/lib/auth";
import {
  bestRows,
  errorMessage,
  integer,
  milestone,
  percent,
} from "@/lib/data";
import { downloadCsv } from "@/lib/download";
import { HistoryChart, SummaryTable } from "./results";
import { Notice, Panel } from "./ui";
import { useDashboard } from "./dashboard-provider";
export function SimulationView({ data }: { data: DashboardData }) {
  const { simulation: result, saveSimulation, info } = useDashboard();
  const [config, setConfig] = useState<SimulationConfig>(
    result?.config ?? {
      nodes: 30,
      rounds: 1600,
      seed: 42,
      cluster_head_count: 1,
      dataset_id: data.dataset.id,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      request.current += 1;
    },
    [],
  );
  const exportResult = () => {
    if (!result || result.config.dataset_id !== data.dataset.id) return;
    downloadCsv(
      `hasil_simulasi_${data.dataset.id}_seed-${result.config.seed}.csv`,
      [
        "Dataset",
        "Seed topologi",
        "Jumlah node",
        "Jumlah cluster head",
        "Horizon ronde",
        "Ronde",
        "Protokol",
        "Node hidup",
      ],
      result.history.map((row) => [
        data.dataset.label,
        result.config.seed,
        result.config.nodes,
        result.config.cluster_head_count,
        result.config.rounds,
        row.round_number,
        row.protocol,
        row.alive_nodes,
      ]),
    );
  };
  const lifetime = bestRows(result?.summary || [], "lnd"),
    pdr = bestRows(result?.summary || [], "pdr_total_pct");
  return (
    <div className="simulation-layout">
      <form
        className="panel content-stack simulation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = ++request.current;
          controller.current = new AbortController();
          setBusy(true);
          setError("");
          try {
            const value = await (
              info?.identity.role === "guest"
                ? readResponse<SimulationResult>
                : api<SimulationResult>
            )("/api/simulate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config),
              signal: AbortSignal.any([
                controller.current.signal,
                AbortSignal.timeout(65000),
              ]),
            });
            if (value.config.dataset_id !== data.dataset.id)
              throw new Error("Hasil simulasi tidak sesuai dataset.");
            if (id === request.current) saveSimulation(value);
          } catch (error) {
            if (id === request.current) setError(errorMessage(error));
          } finally {
            if (id === request.current) setBusy(false);
          }
        }}
      >
        <h2 className="panel-title">Parameter simulasi</h2>
        <fieldset disabled={busy} className="form-grid">
          {(
            [
              {
                key: "nodes",
                label: "Jumlah node",
                min: 10,
                max: 60,
                step: 1,
                help: "10–60 node",
              },
              {
                key: "rounds",
                label: "Horizon ronde",
                min: 100,
                max: 2000,
                step: 100,
                help: "100–2.000 ronde",
              },
              {
                key: "seed",
                label: "Seed topologi",
                min: 0,
                max: 999999,
                step: 1,
                help: "0–999.999",
              },
              {
                key: "cluster_head_count",
                label: "Jumlah cluster head",
                min: 1,
                max: 10,
                step: 1,
                help: "1–10 kepala cluster",
              },
            ] as const
          ).map((item) => (
            <label className="field-label" key={item.key}>
              {item.label}
              <span className="field-help">{item.help}</span>
              <input
                className="field-input"
                type="number"
                required
                min={item.min}
                max={item.max}
                step={item.step}
                value={config[item.key]}
                onChange={(e) =>
                  setConfig({ ...config, [item.key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </fieldset>
        {error && <Notice error>{error}</Notice>}
        {busy && (
          <Notice>
            Simulasi sedang dihitung. Mohon tunggu hingga hasil muncul.
          </Notice>
        )}
        <button
          className="button button-primary w-full justify-center"
          disabled={busy}
          type="submit"
        >
          {busy ? "Simulasi berjalan…" : "Jalankan simulasi"}
        </button>
        <p className="form-footnote">
          Model GWO mengikuti dataset terpilih. Seed dan parameter dicatat pada
          hasil; optimizer tidak dijalankan ulang.
        </p>
      </form>
      <Panel
        title="Ringkasan protokol"
        action={
          <span className="panel-unit">
            {result
              ? `${data.dataset.label} · seed ${integer(result.config.seed)}`
              : "menunggu simulasi"}
          </span>
        }
      >
        {!result ? (
          <div className="result-placeholder">
            <p>Hasil skenario akan muncul di sini setelah simulasi selesai.</p>
          </div>
        ) : (
          <div className="content-stack simulation-result">
            <div className="simulation-stats">
              {[
                [
                  "Umur terpanjang",
                  `${lifetime.map((r) => r.protocol).join(" + ")} · ${milestone(lifetime[0]?.lnd, result.config.rounds)}`,
                ],
                [
                  "PDR tertinggi",
                  `${pdr.map((r) => r.protocol).join(" + ")} · ${percent(pdr[0]?.pdr_total_pct)}`,
                ],
                ["Seed topologi", integer(result.config.seed)],
              ].map(([label, value]) => (
                <div key={label} className="sim-metric">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <HistoryChart rows={result.history} />
            <SummaryTable
              rows={result.summary}
              horizon={result.config.rounds}
            />
            <button
              className="button button-secondary"
              onClick={exportResult}
              disabled={busy}
            >
              Unduh node hidup per ronde CSV
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
