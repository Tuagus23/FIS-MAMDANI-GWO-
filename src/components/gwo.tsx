"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import type { DashboardData, GwoData } from "@/lib/types";
import { decimal, errorMessage, integer, membershipRows } from "@/lib/data";
import { chartOptions } from "@/lib/charts";
import { cachedGwo, loadGwo } from "@/lib/dashboard-cache";
import { Chart } from "./chart";
import { DataDetails, DataTable, Notice, Panel } from "./ui";
export function GwoView({ data }: { data: DashboardData }) {
  const [process, setProcess] = useState<GwoData | null>(
    () => cachedGwo() || null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [iteration, setIteration] = useState(0);
  useEffect(() => {
    let active = true;
    loadGwo()
      .then((value) => {
        if (active) setProcess(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const fitness = useMemo<ChartConfiguration>(
    () => ({
      type: "line",
      data: {
        labels: process?.history.map((row) => `Gen ${row.iteration}`) || [],
        datasets: [
          {
            label: "Terbaik sejauh ini",
            data: process?.history.map((row) => row.best_fitness) || [],
            borderColor: "#00765e",
            pointRadius: 3,
            borderWidth: 2.5,
          },
          {
            label: "Rata-rata populasi",
            data: process?.history.map((row) => row.mean_fitness) || [],
            borderColor: "#3568a8",
            pointRadius: 2,
            borderDash: [5, 4],
            borderWidth: 2,
          },
        ],
      },
      options: chartOptions("Fitness"),
    }),
    [process],
  );
  if (!process)
    return (
      <Notice error={!!error}>
        {error || "Memuat riwayat GWO hasil reproduksi…"}
        {error && (
          <button
            className="button button-quiet"
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Coba lagi
          </button>
        )}
      </Notice>
    );
  const config = process.configuration;
  const population = process.population
    .filter((row) => row.iteration === iteration)
    .sort((a, b) => a.rank - b.rank);
  const alpha = population.find((row) => row.role === "alpha") || population[0];
  return (
    <>
      <Notice>
        {process.matches_saved_membership
          ? `Riwayat reproduksi deterministik cocok dengan MF tersimpan pada ${process.dataset_label}.`
          : `Riwayat ini adalah reproduksi konfigurasi; MF akhir berbeda dari file tersimpan.`}{" "}
        {data.dataset.id !== process.dataset_id &&
          `Dataset aktif ${data.dataset.label}; fitness dan populasi di halaman ini tetap berasal dari ${process.dataset_label}. Tabel MF di bawah mengikuti dataset aktif.`}
      </Notice>
      <Panel
        title="GWO menyetel kurva, FIS memilih node"
        caption="Grey Wolf Optimizer mencari titik transisi MF input yang memberi fitness terbaik. Kandidat dinilai pada kumpulan topologi tetap."
      >
        <div className="process-stat-grid">
          {[
            ["Serigala", config.wolves],
            ["Generasi pembaruan", config.iterations],
            ["Dimensi pencarian", config.dimension],
            ["Evaluasi populasi", config.evaluations],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="process-note">
          {integer(config.fitness_rounds)} ronde · seed fitness{" "}
          {config.fitness_seeds.join(", ")} · seed optimizer{" "}
          {config.optimizer_seed}. Area {config.simulation.width_m} ×{" "}
          {config.simulation.height_m} m; {config.simulation.nodes} node.
        </p>
        <ol className="process-flow">
          {[
            [
              "Representasi",
              "13 koordinat MF",
              "3 energi, 5 jarak, 5 tetangga.",
            ],
            [
              "Populasi awal",
              `${config.wolves} wolf`,
              "MF ahli digunakan sebagai warm start.",
            ],
            [
              "Evaluasi",
              "Fitness pada seed tetap",
              "Jalankan protokol GWO untuk setiap kandidat.",
            ],
            [
              "Pembaruan",
              "Alpha · beta · delta",
              "Gabungkan tarikan tiga pemimpin.",
            ],
            [
              "Hasil",
              "Solusi global terbaik",
              "Decode posisi menjadi titik kurva MF.",
            ],
          ].map(([label, title, text]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel
        title="Konvergensi fitness"
        caption="Nilai lebih tinggi lebih baik. Garis terbaik merangkum solusi global terbaik sampai generasi itu."
      >
        <Chart
          config={fitness}
          label="Fitness terbaik dan rata-rata populasi"
        />
        <DataDetails title="Lihat fitness per generasi">
          <DataTable
            rows={process.history}
            columns={[
              { label: "Generasi", render: (r) => r.iteration },
              {
                label: "Fitness terbaik",
                render: (r) => decimal(r.best_fitness),
              },
              { label: "Rata-rata", render: (r) => decimal(r.mean_fitness) },
            ]}
          />
        </DataDetails>
      </Panel>
      <Panel
        title="Pemimpin populasi"
        action={
          <label className="process-select-label">
            Generasi
            <select
              className="dataset-select"
              value={iteration}
              onChange={(e) => setIteration(Number(e.target.value))}
            >
              {process.history.map((row) => (
                <option key={row.iteration} value={row.iteration}>
                  Generasi {row.iteration}
                  {row.iteration === 0 ? " · awal" : ""}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <DataTable
          rows={population.filter((row) => row.rank <= 4)}
          columns={[
            {
              label: "Peran",
              render: (r) =>
                `${({ alpha: "Alpha · terbaik", beta: "Beta · kedua", delta: "Delta · ketiga" } as Record<string, string>)[r.role] || `Kandidat rank ${r.rank}`} · Wolf ${r.wolf}`,
            },
            { label: "Fitness", render: (r) => decimal(r.fitness) },
            {
              label: "Vektor 13 koordinat",
              render: (r) => (
                <DataDetails title="Lihat posisi">
                  <p className="process-vector">
                    {r.position
                      .map((value, i) => `x${i + 1}=${decimal(value)}`)
                      .join(" · ")}
                  </p>
                </DataDetails>
              ),
            },
          ]}
        />
        <p className="table-footnote">
          Alpha, beta, dan delta memimpin pembaruan. Implementasi proyek tidak
          memakai peran gamma; rank 4 adalah wolf biasa. MF output dan 27 aturan
          Mamdani tetap.
        </p>
        <DataDetails title="Rumus perpindahan">
          <div className="gwo-equations">
            <code>Dα = |C₁ × Xα − X|</code>
            <code>Yα = Xα − A₁ × Dα</code>
            <code>X baru = clip((Yα + Yβ + Yδ) / 3, 0, 1)</code>
            <code>A = a(2r₁ − 1) · C = 2r₂</code>
            <code>a = 2 − 2t / (T − 1)</code>
          </div>
        </DataDetails>
      </Panel>
      <Panel
        title="Posisi Alpha di ruang pencarian"
        caption={`Generasi ${iteration} · Wolf ${alpha?.wolf ?? "—"} · fitness ${decimal(alpha?.fitness)}`}
      >
        <div className="gwo-coordinate-grid">
          {[
            { name: "Energi", tone: "energy", start: 0, end: 3 },
            { name: "Jarak", tone: "distance", start: 3, end: 8 },
            { name: "Jumlah tetangga", tone: "neighbors", start: 8, end: 13 },
          ].map((group) => (
            <section
              className={`gwo-coordinate-group gwo-coordinate-${group.tone}`}
              key={group.name}
            >
              <h3>{group.name}</h3>
              <div className="gwo-coordinate-items">
                {alpha?.position
                  .slice(group.start, group.end)
                  .map((value, i) => (
                    <div className="gwo-coordinate-item" key={i}>
                      <div>
                        <span>x{group.start + i + 1}</span>
                        <strong>{decimal(value)}</strong>
                      </div>
                      <span
                        className="gwo-coordinate-track"
                        role="meter"
                        aria-label={`Koordinat x${group.start + i + 1}`}
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={value}
                      >
                        <i
                          style={{
                            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <p className="table-footnote">
          Koordinat ternormalisasi 0–1; decoder mengubahnya menjadi batas kurva
          MF.
        </p>
      </Panel>
      <Panel title="Apa yang dinilai oleh fitness?">
        <DataTable
          rows={(["manual", "warm_start", "best"] as const).map((key) => ({
            name: {
              manual: "MF awal",
              warm_start: "Warm start",
              best: "Solusi terbaik",
            }[key],
            values: process.comparison[key],
          }))}
          columns={[
            { label: "Tahap", render: (r) => r.name },
            ...[
              "score",
              "fnd",
              "r10",
              "hnd",
              "r90",
              "lnd",
              "peak_residual",
              "mean_residual",
              "pdr_pct",
            ].map((key) => ({
              label: key === "score" ? "Fitness" : key.toUpperCase(),
              render: (r: { values: Record<string, number> }) =>
                decimal(r.values[key]),
            })),
          ]}
        />
        <DataDetails title="Komponen dan bobot">
          <DataTable
            rows={Object.entries(process.weights)}
            columns={[
              { label: "Komponen", render: (r) => r[0] },
              { label: "Bobot", render: (r) => decimal(r[1]) },
            ]}
          />
        </DataDetails>
        <p className="table-footnote">
          Fitness adalah gabungan komponen yang dinormalisasi, dibagi total
          bobot. Milestone tersensor memakai horizon {config.fitness_rounds}.
          R10/R90: 10%/90% node mati.
        </p>
      </Panel>
      <Panel
        title={`MF GWO · ${data.dataset.label}`}
        caption="Titik kurva tersimpan untuk dataset aktif."
      >
        <DataTable
          rows={membershipRows(data.membership)}
          columns={[
            { label: "Variabel", render: (r) => r.variable },
            { label: "Himpunan", render: (r) => r.label },
            { label: "Bentuk", render: (r) => r.shape },
            { label: "Titik kurva", render: (r) => r.points },
          ]}
        />
      </Panel>
    </>
  );
}
