"use client";
import { useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import type {
  DashboardData,
  InputVariable,
  Membership,
  Rule,
} from "@/lib/types";
import { decimal, degree, optimizedColors } from "@/lib/data";
import { calculateFis } from "@/lib/fis";
import { chartOptions } from "@/lib/charts";
import { Chart } from "./chart";
import { DataDetails, DataTable, Notice, Panel } from "./ui";

const inputLabels = {
  energy: "Energi sisa",
  distance: "Jarak ke base station",
  neighbors: "Jumlah tetangga",
};
const variables = Object.keys(inputLabels) as InputVariable[];
const ruleColumns = [
  { label: "Energi", render: (r: Rule) => r.energy, align: "start" as const },
  { label: "Jarak", render: (r: Rule) => r.distance, align: "start" as const },
  {
    label: "Tetangga",
    render: (r: Rule) => r.neighbors,
    align: "start" as const,
  },
  {
    label: "Konsekuen",
    render: (r: Rule) => r.output,
    align: "start" as const,
  },
];

export function FisView({ data }: { data: DashboardData }) {
  const [model, setModel] = useState("gwo");
  const [draft, setDraft] = useState({
    energy: "0.8",
    distance: "30",
    neighbors: "5",
  });
  const membership =
    model === "gwo" ? data.membership : data.membership_baseline;
  const limits = {
    energy: data.membership_ranges.energy.max,
    distance: data.membership_ranges.distance.max,
    neighbors: data.fis_process.nodes - 1,
  };
  const inputs = Object.fromEntries(
    variables.map((key) => [key, Number(draft[key])]),
  ) as Record<InputVariable, number>;
  const valid = variables.every(
    (key) =>
      draft[key].trim() !== "" &&
      Number.isFinite(inputs[key]) &&
      inputs[key] >= 0 &&
      inputs[key] <= limits[key] &&
      (key !== "neighbors" || Number.isInteger(inputs[key])),
  );
  const result = useMemo(
    () =>
      valid
        ? calculateFis(membership, data.fis_process, {
            energy: Number(draft.energy),
            distance: Number(draft.distance),
            neighbors: Number(draft.neighbors),
          })
        : null,
    [membership, data.fis_process, draft, valid],
  );
  return (
    <>
      <Panel
        title="Dari kondisi node ke skor"
        caption={`FIS Mamdani memakai ${data.fis_process.rule_count} aturan dan ${data.fis_process.output_points} titik output. FUZZY menggunakan MF awal; GWO memakai MF input yang dikalibrasi.`}
      >
        <ol className="process-flow">
          {[
            [
              "Masukan",
              "Energi · jarak · tetangga",
              "Fitur node aktif pada setiap ronde.",
            ],
            [
              "Fuzzifikasi",
              "Derajat keanggotaan 0–1",
              "Satu input dapat masuk ke beberapa himpunan.",
            ],
            [
              "Inferensi",
              "MIN dan MAX",
              "MIN mengaktifkan aturan; MAX menggabungkan output.",
            ],
            [
              "Defuzzifikasi",
              "Centroid",
              "Titik berat menghasilkan satu skor tegas.",
            ],
            [
              "Pemilihan CH",
              "Urutkan skor",
              "Node dengan skor tertinggi menjadi cluster head.",
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
        title="Coba satu kandidat node"
        caption="Ubah angka atau geser kontrol. Derajat keanggotaan, aturan aktif, dan centroid dihitung langsung dengan dataset yang dipilih."
      >
        <div className="fis-model-toolbar">
          <label className="field-label" htmlFor="fisModel">
            Kurva input
          </label>
          <select
            id="fisModel"
            className="field-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gwo">MF GWO · dataset aktif</option>
            <option value="baseline">MF awal</option>
          </select>
          <span className="fis-live-label">Diperbarui saat input berubah</span>
        </div>
        <div className="fis-workbench">
          <div className="fis-inputs">
            <h3>Masukan kandidat</h3>
            {variables.map((key) => (
              <div className="fis-input-group" key={key}>
                <label className="field-label" htmlFor={`fis-${key}`}>
                  {inputLabels[key]}
                </label>
                <div className="fis-number-unit">
                  <input
                    id={`fis-${key}`}
                    className="field-input"
                    type="number"
                    required
                    min={0}
                    max={limits[key]}
                    step={key === "neighbors" ? 1 : 0.01}
                    value={draft[key]}
                    aria-describedby={`fis-${key}-hint`}
                    onChange={(e) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: e.target.value,
                      }))
                    }
                  />
                  <span>
                    {key === "energy"
                      ? "rasio"
                      : key === "distance"
                        ? "m"
                        : "node"}
                  </span>
                </div>
                <input
                  className="fis-range"
                  type="range"
                  aria-label={`Geser ${inputLabels[key]}`}
                  min={0}
                  max={limits[key]}
                  step={key === "neighbors" ? 1 : 0.01}
                  value={Math.max(0, Math.min(limits[key], inputs[key] || 0))}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      [key]: e.target.value,
                    }))
                  }
                />
                <span id={`fis-${key}-hint`} className="field-help">
                  Rentang 0–{decimal(limits[key])}
                  {key === "neighbors" ? ", bilangan bulat" : ""}
                </span>
              </div>
            ))}
            <p className="form-footnote">
              Skor ini menilai satu kandidat. Pemilihan cluster head
              membandingkan skor seluruh node.
            </p>
          </div>
          {result ? (
            <FisResult
              result={result}
              membership={membership}
              modelLabel={
                model === "gwo" ? `MF GWO · ${data.dataset.label}` : "MF awal"
              }
            />
          ) : (
            <Notice>
              Lengkapi semua input dengan angka dalam rentang yang ditampilkan
              untuk melihat hasil.
            </Notice>
          )}
        </div>
      </Panel>
      <Panel
        title="Basis aturan Mamdani"
        caption="Semua kombinasi energi × jarak × tetangga. Konsekuen diambil langsung dari server."
      >
        <DataTable
          label="Basis aturan Mamdani"
          rows={data.fis_process.rules.map((rule, i) => ({
            ...rule,
            index: i + 1,
          }))}
          columns={[
            { label: "Aturan", render: (r) => `R${r.index}` },
            ...ruleColumns,
          ]}
        />
      </Panel>
    </>
  );
}

function FisResult({
  result,
  membership,
  modelLabel,
}: {
  result: ReturnType<typeof calculateFis>;
  membership: Membership;
  modelLabel: string;
}) {
  const activeRules = result.rules
    .filter((rule) => rule.strength > 0)
    .sort((a, b) => b.strength - a.strength);
  const output = useMemo<ChartConfiguration>(
    () => ({
      type: "line",
      data: {
        datasets: [
          ...Object.entries(result.activations).map(
            ([label, activation], index) => ({
              label,
              data: result.x.map((x) => ({
                x,
                y: Math.min(activation, degree(membership.output[label], x)),
              })),
              borderColor: optimizedColors[index],
              pointRadius: 0,
              borderWidth: 1.5,
            }),
          ),
          {
            label: "Agregasi MAX",
            data: result.x.map((x, i) => ({ x, y: result.aggregate[i] })),
            borderColor: "#193832",
            backgroundColor: "#19383218",
            fill: "origin",
            pointRadius: 0,
            borderWidth: 3,
          },
          {
            label: `Centroid ${decimal(result.score)}`,
            data: [
              { x: result.score, y: 0 },
              { x: result.score, y: 1 },
            ],
            borderColor: "#b34d16",
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...chartOptions("Derajat keanggotaan"),
        interaction: { mode: "nearest", intersect: false },
        plugins: { ...chartOptions("").plugins, legend: { display: false } },
        scales: {
          x: {
            type: "linear",
            min: 0,
            max: 1,
            title: { display: true, text: "Skor kelayakan" },
            ticks: { stepSize: 0.2 },
          },
          y: { min: 0, max: 1, ticks: { stepSize: 0.25 } },
        },
      },
    }),
    [result, membership],
  );
  return (
    <div className="fis-result">
      <div className="fis-score-line">
        <div>
          <span>Skor kelayakan kandidat</span>
          <p>{modelLabel}</p>
        </div>
        <output aria-label="Skor kelayakan kandidat" aria-live="polite">
          {decimal(result.score)}
        </output>
      </div>
      <div className="fis-visual-grid">
        <section className="fis-visual">
          <h3>Derajat keanggotaan input</h3>
          <p>
            MIN memilih nilai terkecil dari tiga input untuk mengaktifkan
            aturan.
          </p>
          <div className="fis-degree-groups">
            {variables.map((key) => (
              <section className="fis-degree-group" key={key}>
                <h4>{inputLabels[key]}</h4>
                {Object.entries(result.degrees[key]).map(
                  ([label, value], i) => (
                    <div className="fis-degree-row" key={label}>
                      <span>{label}</span>
                      <div
                        className="degree-meter"
                        role="meter"
                        aria-label={`${inputLabels[key]} · ${label}`}
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={value}
                      >
                        <i
                          style={{
                            transform: `scaleX(${value})`,
                            backgroundColor: optimizedColors[i],
                          }}
                        />
                      </div>
                      <strong>{decimal(value)}</strong>
                    </div>
                  ),
                )}
              </section>
            ))}
          </div>
        </section>
        <section className="fis-visual">
          <h3>Agregasi output dan centroid</h3>
          <p>
            Area hijau menggabungkan output dengan MAX. Garis jingga menandai
            titik beratnya.
          </p>
          <Chart
            config={output}
            label={`Agregasi output dengan centroid ${decimal(result.score)}`}
          />
          <dl className="fis-activation-list">
            {Object.entries(result.activations).map(([label, value], i) => (
              <div key={label}>
                <dt>
                  <i style={{ backgroundColor: optimizedColors[i] }} />
                  {label}
                </dt>
                <dd>{decimal(value)}</dd>
              </div>
            ))}
          </dl>
          <DataDetails title="Lihat nilai output">
            <DataTable
              label="Sampel agregasi output"
              rows={result.x.flatMap((x, i) =>
                i % 25 === 0 || i === result.x.length - 1
                  ? [{ x, y: result.aggregate[i] }]
                  : [],
              )}
              columns={[
                { label: "Skor output", render: (r) => decimal(r.x) },
                { label: "Agregasi MAX", render: (r) => decimal(r.y) },
              ]}
            />
          </DataDetails>
        </section>
      </div>
      <section className="fis-active-rules">
        <h3>
          Aturan yang aktif{" "}
          <span>
            {activeRules.length} dari {result.rules.length}
          </span>
        </h3>
        {activeRules.length ? (
          <DataTable
            label="Aturan FIS yang aktif"
            rows={activeRules}
            columns={[
              { label: "Aturan", render: (r) => `R${r.index}` },
              ...ruleColumns,
              { label: "Kekuatan MIN", render: (r) => decimal(r.strength) },
            ]}
          />
        ) : (
          <p className="table-footnote">
            Tidak ada aturan aktif untuk kombinasi ini. Nilai fallback sistem
            adalah 0,50.
          </p>
        )}
      </section>
    </div>
  );
}
