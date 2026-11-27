"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ChartConfiguration } from "chart.js";
import type { DashboardData, Metric } from "@/lib/types";
import {
  colors,
  decimal,
  integer,
  milestone,
  percent,
  shapes,
} from "@/lib/data";
import { chartOptions, validationConfig } from "@/lib/charts";
import { downloadCsv } from "@/lib/download";
import { Chart } from "./chart";
import { DataDetails, DataTable, Notice, Panel } from "./ui";
export function ValidationView({ data }: { data: DashboardData }) {
  const [metric, setMetric] = useState<Metric>("FND");
  const means = useMemo(() => validationConfig(data), [data]);
  const seeds = useMemo(
    () => [...data.validation_rows].sort((a, b) => a.seed - b.seed),
    [data],
  );
  const censored = (protocol: "FUZZY" | "GWO", key: Metric) =>
    seeds.filter((row) =>
      key === "lifetime_index"
        ? (["FND", "HND", "LND"] as const).some(
            (k) => row[`${protocol}_${k}`] === null,
          )
        : row[`${protocol}_${key}`] === null,
    ).length;
  const seedValue = (value: number | null | undefined) =>
    metric === "PDR_pct"
      ? percent(value)
      : milestone(value, data.validation_horizon);
  const config = useMemo<ChartConfiguration>(
    () => ({
      type: "scatter",
      data: {
        datasets: (["FUZZY", "GWO"] as const).map((protocol) => ({
          label: protocol,
          data: seeds.flatMap((row, index) => {
            const value = row[`${protocol}_${metric}`];
            return value == null && metric === "PDR_pct"
              ? []
              : [
                  {
                    x: index + (protocol === "FUZZY" ? -0.22 : 0.22),
                    y: value ?? data.validation_horizon,
                  },
                ];
          }),
          backgroundColor: colors[protocol],
          pointStyle: shapes[protocol],
          pointRadius: 5,
          pointHoverRadius: 8,
        })),
      },
      options: {
        ...chartOptions(metric === "PDR_pct" ? "PDR (%)" : "Ronde"),
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          ...chartOptions("").plugins,
          tooltip: {
            callbacks: {
              title: (items) =>
                `Seed ${seeds[Math.round(items[0].parsed.x)]?.seed}`,
              label: (ctx) => {
                const row = seeds[Math.round(ctx.parsed.x)];
                const value =
                  row?.[`${ctx.dataset.label as "FUZZY" | "GWO"}_${metric}`];
                return `${ctx.dataset.label}: ${metric === "PDR_pct" ? percent(value) : milestone(value, data.validation_horizon)}`;
              },
            },
          },
        },
        scales: {
          ...chartOptions("").scales,
          x: {
            type: "linear",
            min: -0.5,
            max: Math.max(0.5, seeds.length - 0.5),
            grid: { display: false },
            ticks: {
              stepSize: 1,
              callback: (value) => seeds[Math.round(Number(value))]?.seed ?? "",
            },
            title: { display: true, text: "Seed uji" },
          },
          y: {
            ...chartOptions("").scales?.y,
            beginAtZero: metric !== "PDR_pct",
          },
        },
      },
    }),
    [data.validation_horizon, seeds, metric],
  );
  const conclusionRows = data.validation.filter(
    (row) => row.metric !== "lifetime_index",
  );
  const lifetimeRows = data.validation.filter((row) =>
    ["FND", "HND", "LND"].includes(row.metric),
  );
  const meanValue = (
    row: DashboardData["validation"][number],
    protocol: "FUZZY" | "GWO",
  ) =>
    `${decimal(row[`${protocol}_mean`])}${censored(protocol, row.metric) ? "*" : ""}`;
  const differingWinners = conclusionRows.filter(
    (row) =>
      row.GWO_mean !== null &&
      row.FUZZY_mean !== null &&
      (row.GWO_wins - row.FUZZY_wins) * (row.GWO_mean - row.FUZZY_mean) < 0,
  );
  const conclusion = (["FND", "HND", "LND", "PDR_pct"] as const)
    .map((key) => {
      const row = data.validation.find((r) => r.metric === key);
      if (!row) return "";
      const winner =
        row.GWO_wins > row.FUZZY_wins
          ? "GWO"
          : row.GWO_wins < row.FUZZY_wins
            ? "FUZZY"
            : "Seimbang";
      return `${key === "PDR_pct" ? "PDR" : key}: ${winner} (${Math.max(row.GWO_wins, row.FUZZY_wins)}/${row.seed_count} seed${row.ties ? `, ${row.ties} seri` : ""})`;
    })
    .filter(Boolean)
    .join(". ");
  const download = () =>
    downloadCsv(
      `validasi_${data.dataset.id}.csv`,
      [
        "Dataset",
        "Metrik",
        "FUZZY rata-rata",
        "GWO rata-rata",
        "Δ GWO − FUZZY",
        "Menang GWO",
        "Menang FUZZY",
        "Seri",
        "Jumlah seed",
        "Seed tersensor FUZZY",
        "Seed tersensor GWO",
      ],
      data.validation.map((row) => [
        data.dataset.label,
        row.metric,
        row.FUZZY_mean,
        row.GWO_mean,
        row.mean_delta_GWO_minus_FUZZY,
        row.GWO_wins,
        row.FUZZY_wins,
        row.ties,
        row.seed_count,
        censored("FUZZY", row.metric),
        censored("GWO", row.metric),
      ]),
    );
  if (!data.validation.length)
    return <Notice>Data validasi tidak tersedia pada dataset ini.</Notice>;
  return (
    <>
      <section className="panel" aria-labelledby="validation-guide-title">
        <h2 className="panel-title" id="validation-guide-title">
          Perbedaan Ringkasan dan Validasi model
        </h2>
        <dl className="validation-guide-pages">
          <div>
            <dt>
              <Link href="/">Ringkasan</Link>
            </dt>
            <dd className="panel-caption">
              Membandingkan FUZZY, LEACH, dan GWO pada satu simulasi dengan satu
              susunan node (satu seed).
            </dd>
          </div>
          <div>
            <dt>Validasi model</dt>
            <dd className="panel-caption">
              Membandingkan FUZZY dan GWO pada {integer(seeds.length)} seed uji
              lain dengan susunan node berbeda. Hasilnya ditampilkan sebagai
              rata-rata dan sebaran per seed.
            </dd>
          </div>
        </dl>
        <p className="panel-caption validation-guide-note">
          Satu dataset memuat hasil kedua pengujian. Nilai LND (ronde saat node
          terakhir mati) bisa berbeda karena dihitung dari percobaan yang
          berbeda.
        </p>
      </section>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title={`Rata-rata ${integer(seeds.length)} seed uji`}
          caption={`Model dari dataset ${data.dataset.label}. Grafik merangkum pengujian FUZZY dan GWO pada topologi validasi.`}
        >
          <Chart
            config={means}
            label={`Rata-rata metrik validasi · ${data.dataset.label} · ${seeds.length} seed uji`}
          />
          <DataTable
            label={`Angka grafik validasi · ${data.dataset.label}`}
            rows={lifetimeRows}
            columns={[
              { label: "Metrik", render: (r) => r.metric },
              { label: "FUZZY (ronde)", render: (r) => meanValue(r, "FUZZY") },
              { label: "GWO (ronde)", render: (r) => meanValue(r, "GWO") },
            ]}
          />
          <p className="table-footnote">
            * Batas bawah rata-rata. Milestone yang belum tercapai dihitung pada
            batas pengamatan {integer(data.validation_horizon)} ronde.
          </p>
          <DataDetails title="Daftar seed uji">
            <p className="panel-caption">
              Seed uji {seeds.map((row) => row.seed).join(", ")}. Batas
              pengamatan {integer(data.validation_horizon)} ronde.
            </p>
          </DataDetails>
        </Panel>
        <Panel
          title="Jumlah kemenangan per seed"
          caption={`FUZZY dan GWO diuji pada ${integer(seeds.length)} seed dari dataset ${data.dataset.label}.`}
        >
          <p className="sr-only">{conclusion}.</p>
          <div className="validation-wins-key" aria-hidden="true">
            <span>
              <i className="is-fuzzy" />
              FUZZY
            </span>
            <span>
              <i className="is-tie" />
              Seri
            </span>
            <span>
              <i className="is-gwo" />
              GWO
            </span>
          </div>
          <div className="validation-wins">
            {conclusionRows.map((row) => (
              <section className="validation-win-row" key={row.metric}>
                <div className="validation-win-label">
                  <strong>
                    {row.metric === "PDR_pct" ? "PDR" : row.metric}
                  </strong>
                  <span>
                    {row.GWO_wins === row.FUZZY_wins
                      ? "Jumlah kemenangan sama"
                      : `${row.GWO_wins > row.FUZZY_wins ? "GWO" : "FUZZY"} menang ${Math.max(row.GWO_wins, row.FUZZY_wins)} dari ${row.seed_count} seed`}
                  </span>
                </div>
                <div
                  className="validation-win-bar"
                  role="img"
                  aria-label={`${row.metric}: FUZZY ${row.FUZZY_wins}, seri ${row.ties}, GWO ${row.GWO_wins} dari ${row.seed_count} seed`}
                >
                  {[
                    { count: row.FUZZY_wins, tone: "is-fuzzy" },
                    { count: row.ties, tone: "is-tie" },
                    { count: row.GWO_wins, tone: "is-gwo" },
                  ]
                    .filter((part) => part.count > 0)
                    .map((part) => (
                      <span
                        key={part.tone}
                        className={part.tone}
                        style={{ flex: part.count }}
                      >
                        {part.count}
                      </span>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <p className="panel-caption">
            Setiap seed dihitung satu kali. Nilai metrik lebih besar dihitung
            lebih baik. Rata-rata pada grafik juga dipengaruhi besar selisih
            nilai di setiap seed.
          </p>
          {differingWinners.map((row) => {
            const countWinner = row.GWO_wins > row.FUZZY_wins ? "GWO" : "FUZZY";
            const meanWinner =
              row.GWO_mean! > row.FUZZY_mean! ? "GWO" : "FUZZY";
            return (
              <p className="table-footnote" key={row.metric}>
                {row.metric === "PDR_pct" ? "PDR" : row.metric} — {countWinner}{" "}
                menang pada lebih banyak seed. Rata-rata {meanWinner} lebih
                tinggi karena besar selisih nilai antarseed.
              </p>
            );
          })}
        </Panel>
      </div>
      <Panel
        title="Sebaran hasil per seed uji"
        action={
          <select
            className="dataset-select"
            aria-label="Metrik sebaran"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {["FND", "HND", "LND", "PDR_pct"].map((key) => (
              <option key={key} value={key}>
                {key === "PDR_pct" ? "PDR" : key}
              </option>
            ))}
          </select>
        }
        caption="Setiap pasangan titik mewakili satu seed uji, terpisah dari seed kalibrasi. Milestone tersensor ditampilkan pada batas horizon; nilainya diberi tanda > pada tabel."
      >
        <div className="seed-analysis-grid">
          <Chart config={config} label="Sebaran metrik setiap seed uji" />
          <section className="seed-table-panel">
            <h3>Nilai seed uji · {metric === "PDR_pct" ? "PDR" : metric}</h3>
            <DataTable
              rows={seeds}
              columns={[
                { label: "Seed uji", render: (r) => integer(r.seed) },
                {
                  label: "FUZZY",
                  render: (r) => seedValue(r[`FUZZY_${metric}`]),
                },
                { label: "GWO", render: (r) => seedValue(r[`GWO_${metric}`]) },
              ]}
            />
          </section>
        </div>
      </Panel>
      <Panel
        title="Nilai rata-rata dan jumlah kemenangan"
        action={
          <button className="button button-secondary" onClick={download}>
            Unduh validasi CSV
          </button>
        }
      >
        <DataTable
          rows={data.validation}
          columns={[
            {
              label: "Metrik",
              render: (r) =>
                r.metric === "lifetime_index"
                  ? "Indeks umur"
                  : r.metric === "PDR_pct"
                    ? "PDR"
                    : r.metric,
            },
            ...(["FUZZY", "GWO"] as const).map((protocol) => ({
              label: protocol,
              render: (r: DashboardData["validation"][number]) =>
                `${r.metric === "PDR_pct" ? percent(r[`${protocol}_mean`]) : decimal(r[`${protocol}_mean`])}${censored(protocol, r.metric) ? "*" : ""}`,
            })),
            {
              label: <abbr title="Rata-rata GWO dikurangi FUZZY">Δ GWO</abbr>,
              render: (r) =>
                `${(r.mean_delta_GWO_minus_FUZZY ?? 0) > 0 ? "+" : ""}${decimal(r.mean_delta_GWO_minus_FUZZY)}${r.metric === "PDR_pct" ? " pp" : ""}`,
            },
            { label: "Menang GWO", render: (r) => r.GWO_wins },
            { label: "Menang FUZZY", render: (r) => r.FUZZY_wins },
            { label: "Seri", render: (r) => r.ties },
          ]}
        />
        <p className="table-footnote">
          Jumlah seed: {seeds.length}. * Rata-rata memakai batas horizon untuk
          milestone tersensor. LND belum tercapai: FUZZY{" "}
          {censored("FUZZY", "LND")}, GWO {censored("GWO", "LND")} seed.
        </p>
      </Panel>
    </>
  );
}
