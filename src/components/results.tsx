"use client";
import { useMemo } from "react";
import type { DashboardData, HistoryRow, Summary } from "@/lib/types";
import { bestRows, integer, milestone, percent } from "@/lib/data";
import { historyConfig, lifetimeConfig } from "@/lib/charts";
import { Chart } from "./chart";
import { DataDetails, DataTable, Panel, ProtocolName, Notice } from "./ui";
import { NetworkTopologyPanel } from "./network-topology";
export function SummaryTable({
  rows,
  horizon,
}: {
  rows: Summary[];
  horizon: number;
}) {
  return (
    <DataTable
      rows={rows}
      columns={[
        {
          label: "Protokol",
          render: (r) => <ProtocolName name={r.protocol} />,
        },
        ...(["fnd", "hnd", "lnd"] as const).map((key) => ({
          label: (
            <abbr
              title={
                {
                  fnd: "Ronde saat node pertama mati",
                  hnd: "Ronde saat separuh node mati",
                  lnd: "Ronde saat node terakhir mati",
                }[key]
              }
            >
              {key.toUpperCase()}
            </abbr>
          ),
          render: (r: Summary) => milestone(r[key], horizon),
        })),
        {
          label: (
            <abbr title="Persentase paket yang diterima base station">PDR</abbr>
          ),
          render: (r) => percent(r.pdr_total_pct),
        },
        { label: "Ronde akhir", render: (r) => integer(r.last_round) },
      ]}
    />
  );
}
export function HistoryChart({ rows }: { rows: HistoryRow[] }) {
  const config = useMemo(() => historyConfig(rows), [rows]);
  return (
    <>
      {rows.length ? (
        <Chart config={config} label="Jumlah node hidup per ronde" />
      ) : (
        <Notice>Data per ronde belum tersedia.</Notice>
      )}
      <DataDetails title="Lihat tabel node hidup per ronde">
        <DataTable
          rows={[...rows].sort(
            (a, b) =>
              a.round_number - b.round_number ||
              a.protocol.localeCompare(b.protocol),
          )}
          columns={[
            { label: "Ronde", render: (r) => integer(r.round_number) },
            {
              label: "Protokol",
              align: "start",
              render: (r) => <ProtocolName name={r.protocol} />,
            },
            { label: "Node hidup", render: (r) => integer(r.alive_nodes) },
          ]}
        />
      </DataDetails>
    </>
  );
}
export function Results({ data }: { data: DashboardData }) {
  const lifetime = useMemo(
    () => lifetimeConfig(data.summary, data.horizon),
    [data],
  );
  return (
    <>
      {!data.summary.length ? (
        <Notice>Ringkasan belum tersedia pada dataset ini.</Notice>
      ) : (
        <div className="summary-stats">
          {(
            [
              ["lnd", "Umur terpanjang"],
              ["pdr_total_pct", "PDR tertinggi"],
              ["fnd", "FND tertinggi"],
              ["hnd", "HND tertinggi"],
            ] as const
          ).map(([key, label]) => {
            const best = bestRows(data.summary, key);
            return (
              <article className="metric-card" key={key}>
                <p className="metric-label">{label}</p>
                <p className="metric-value">
                  {best.map((r) => r.protocol).join(" + ") || "—"}
                </p>
                <p className="metric-sub">
                  {best.length
                    ? key === "pdr_total_pct"
                      ? percent(best[0][key])
                      : `${milestone(best[0][key], data.horizon)} ronde · ${key.toUpperCase()}`
                    : "Belum tersedia"}
                </p>
              </article>
            );
          })}
        </div>
      )}
      <div className="summary-charts">
        <Panel
          title="Ronde kematian node"
          caption="FND: node pertama mati. HND: separuh node mati. LND: node terakhir mati. Milestone yang belum tercapai memakai batas horizon pada grafik dan tanda > di tooltip."
        >
          <Chart config={lifetime} label="Perbandingan FND, HND, dan LND" />
          <DataDetails title="Lihat nilai milestone">
            <SummaryTable rows={data.summary} horizon={data.horizon} />
          </DataDetails>
        </Panel>
        <Panel
          title="Node yang masih hidup"
          caption="Jumlah node aktif pada setiap ronde dari hasil eksperimen tersimpan."
        >
          <HistoryChart rows={data.history} />
        </Panel>
      </div>
      <NetworkTopologyPanel topologies={data.topologies} />
      <Panel title="Ringkasan metrik">
        <SummaryTable rows={data.summary} horizon={data.horizon} />
        <p className="table-footnote">
          PDR menunjukkan persentase paket data yang berhasil diterima base
          station.
        </p>
      </Panel>
      <DataDetails
        title="Glosarium metrik dan istilah"
        className="glossary-details"
      >
        <dl className="metric-guide">
          {Object.entries({
            FND: "Ronde saat node pertama kehabisan energi.",
            HND: "Ronde saat setidaknya separuh node mati.",
            LND: "Ronde saat node terakhir mati.",
            PDR: "Persentase paket data yang sampai ke base station.",
            "Indeks umur":
              "Rata-rata FND, HND, dan LND dibagi horizon. Milestone tersensor memakai batas horizon.",
            MF: "Fungsi keanggotaan yang memetakan input ke derajat 0–1.",
            "Seed topologi":
              "Angka awal acak untuk membentuk susunan node yang dapat diulang.",
            "Δ GWO":
              "Rata-rata GWO dikurangi FUZZY. Selisih PDR dinyatakan dalam poin persentase.",
          }).map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </DataDetails>
    </>
  );
}
