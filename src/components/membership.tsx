"use client";
import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import type { DashboardData, MembershipSpec, Variable } from "@/lib/types";
import { decimal, degree, initialColors, optimizedColors } from "@/lib/data";
import { chartOptions } from "@/lib/charts";
import { downloadFile } from "@/lib/download";
import { Chart } from "./chart";
import { DataDetails, DataTable } from "./ui";
const definitions: { key: Variable; title: string; unit: string }[] = [
  { key: "energy", title: "Energi sisa", unit: "rasio energi" },
  { key: "distance", title: "Jarak ke base station", unit: "meter" },
  { key: "neighbors", title: "Jumlah tetangga", unit: "node" },
  { key: "output", title: "Skor kelayakan", unit: "skor Mamdani" },
];
export function MembershipView({ data }: { data: DashboardData }) {
  return (
    <>
      <div className="membership-grid grid grid-cols-1 gap-5 xl:grid-cols-2">
        {definitions.map((item) => (
          <article key={item.key} className="membership-card">
            <h3>{item.title}</h3>
            <p>{item.unit}</p>
            <div className="membership-comparison-grid">
              <MembershipPlot
                title="MF awal"
                group={data.membership_baseline[item.key]}
                range={data.membership_ranges[item.key]}
                initial
              />
              {item.key === "output" ? (
                <section className="membership-series-panel is-gwo is-unoptimized">
                  <header className="membership-series-heading">
                    <h4>GWO</h4>
                    <span>Tanpa optimasi</span>
                  </header>
                  <p className="membership-static-note">
                    Skor kelayakan tetap memakai kurva MF awal.
                  </p>
                </section>
              ) : (
                <MembershipPlot
                  title="GWO"
                  group={data.membership[item.key]}
                  range={data.membership_ranges[item.key]}
                />
              )}
            </div>
            <DataDetails title="Lihat tabel nilai kurva">
              <MembershipTable data={data} variable={item.key} />
            </DataDetails>
          </article>
        ))}
      </div>
      <div className="info-strip">
        <p>
          Panel kiri: MF awal dengan garis putus-putus. Panel kanan: MF setelah
          optimasi GWO dengan garis solid dan palet berbeda. Warna dalam setiap
          panel membedakan himpunan. MF output tetap.
        </p>
      </div>
      <button
        className="button button-secondary"
        onClick={() =>
          downloadFile(
            `parameter_mf_${data.dataset.id}.json`,
            JSON.stringify(data.membership, null, 2),
            "application/json;charset=utf-8",
          )
        }
      >
        Unduh parameter MF (JSON)
      </button>
    </>
  );
}
function MembershipPlot({
  title,
  group,
  range,
  initial = false,
}: {
  title: string;
  group: Record<string, MembershipSpec>;
  range: { min: number; max: number };
  initial?: boolean;
}) {
  const config = useMemo<ChartConfiguration>(() => {
    const values = [
      ...new Set([
        ...Array.from(
          { length: 121 },
          (_, i) => range.min + ((range.max - range.min) * i) / 120,
        ),
        ...Object.values(group).flatMap((spec) => spec.points),
      ]),
    ].sort((a, b) => a - b);
    return {
      type: "line",
      data: {
        datasets: Object.entries(group).map(([label, spec], index) => ({
          label,
          data: values.map((x) => ({ x, y: degree(spec, x) })),
          borderColor: (initial ? initialColors : optimizedColors)[index % 3],
          backgroundColor: (initial ? initialColors : optimizedColors)[
            index % 3
          ],
          borderDash: initial ? [6, 4] : [],
          borderWidth: initial ? 2.5 : 3,
          pointRadius: 0,
          tension: 0,
        })),
      },
      options: {
        ...chartOptions("Derajat keanggotaan"),
        plugins: {
          ...chartOptions("").plugins,
          legend: {
            position: "bottom",
            labels: { boxWidth: 20, boxHeight: 2, font: { size: 13 } },
          },
        },
        scales: {
          x: {
            type: "linear",
            min: range.min,
            max: range.max,
            ticks: { maxTicksLimit: 5 },
          },
          y: { min: 0, max: 1, ticks: { stepSize: 0.25 } },
        },
      },
    };
  }, [group, range, initial]);
  return (
    <section
      className={`membership-series-panel ${initial ? "is-initial" : "is-gwo"}`}
    >
      <header className="membership-series-heading">
        <h4>{title}</h4>
        <span>{initial ? "Sebelum optimasi" : "Hasil optimasi"}</span>
      </header>
      <Chart config={config} label={`Kurva ${title}`} compact />
    </section>
  );
}
function MembershipTable({
  data,
  variable,
}: {
  data: DashboardData;
  variable: Variable;
}) {
  const range = data.membership_ranges[variable];
  const models =
    variable === "output"
      ? [{ name: "MF awal (tetap)", group: data.membership_baseline[variable] }]
      : [
          { name: "MF awal", group: data.membership_baseline[variable] },
          { name: "GWO", group: data.membership[variable] },
        ];
  const values = [
    ...new Set([
      ...Array.from(
        { length: 21 },
        (_, i) => range.min + ((range.max - range.min) * i) / 20,
      ),
      ...models.flatMap((model) =>
        Object.values(model.group).flatMap((spec) => spec.points),
      ),
    ]),
  ].sort((a, b) => a - b);
  return (
    <DataTable
      rows={values}
      columns={[
        { label: "Nilai input", render: (x) => decimal(x) },
        ...models.flatMap((model) =>
          Object.entries(model.group).map(([label, spec]) => ({
            label: `${model.name} · ${label}`,
            render: (x: number) => decimal(degree(spec, x)),
          })),
        ),
      ]}
    />
  );
}
