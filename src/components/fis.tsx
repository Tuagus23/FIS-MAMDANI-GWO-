"use client";
import { useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import type { DashboardData, InputVariable, Rule } from "@/lib/types";
import { decimal, degree, optimizedColors } from "@/lib/data";
import { calculateFis } from "@/lib/fis";
import { chartOptions } from "@/lib/charts";
import { Chart } from "./chart";
import { DataDetails, DataTable, Panel } from "./ui";
const inputLabels = {
  energy: "Energi sisa",
  distance: "Jarak ke base station",
  neighbors: "Jumlah tetangga",
};
const ruleColumns = [
  { label: "Energi", render: (r: Rule) => r.energy },
  { label: "Jarak", render: (r: Rule) => r.distance },
  { label: "Tetangga", render: (r: Rule) => r.neighbors },
  { label: "Konsekuen", render: (r: Rule) => r.output },
];
export function FisView({ data }: { data: DashboardData }) {
  const [model, setModel] = useState("gwo");
  const [inputs, setInputs] = useState({
    energy: 0.8,
    distance: 30,
    neighbors: 5,
  });
  const [values, setValues] = useState(inputs);
  const membership =
    model === "gwo" ? data.membership : data.membership_baseline;
  const result = useMemo(
    () => calculateFis(membership, data.fis_process, values),
    [membership, data, values],
  );
  const degrees = useMemo<ChartConfiguration>(
    () => ({
      type: "bar",
      data: {
        labels: Object.values(inputLabels),
        datasets: [0, 1, 2].map((index) => ({
          label: [
            "Rendah / dekat / sedikit",
            "Sedang",
            "Tinggi / jauh / banyak",
          ][index],
          data: (Object.keys(inputLabels) as InputVariable[]).map(
            (key) => Object.values(result.degrees[key])[index],
          ),
          backgroundColor: optimizedColors[index],
          borderRadius: 3,
        })),
      },
      options: {
        ...chartOptions("Derajat"),
        scales: { ...chartOptions("").scales, y: { min: 0, max: 1 } },
      },
    }),
    [result],
  );
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
        ...chartOptions("Derajat"),
        scales: {
          x: { type: "linear", min: 0, max: 1 },
          y: { min: 0, max: 1 },
        },
      },
    }),
    [result, membership],
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
        caption="Kalkulator mengikuti MF dan aturan dari dataset aktif. Skor satu kandidat belum merupakan pemilihan CH dari seluruh node."
      >
        <div className="fis-workbench">
          <form
            className="fis-inputs"
            onSubmit={(e) => {
              e.preventDefault();
              setValues({ ...inputs });
            }}
          >
            <label className="field-label">
              Kurva input
              <select
                className="field-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="gwo">MF GWO · dataset aktif</option>
                <option value="baseline">MF awal</option>
              </select>
            </label>
            {(Object.keys(inputLabels) as InputVariable[]).map((key) => (
              <label className="field-label" key={key}>
                {inputLabels[key]}
                <span className="field-help">
                  {key === "energy"
                    ? "Fraksi energi (0–1)"
                    : key === "distance"
                      ? "Meter"
                      : "Node di sekitar kandidat"}
                </span>
                <input
                  className="field-input"
                  type="number"
                  required
                  min={0}
                  max={
                    key === "neighbors"
                      ? data.fis_process.nodes - 1
                      : data.membership_ranges[key].max
                  }
                  step={key === "neighbors" ? 1 : 0.01}
                  value={inputs[key]}
                  onChange={(e) =>
                    setInputs({ ...inputs, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <button className="button button-primary" type="submit">
              Hitung skor FIS
            </button>
          </form>
          <div className="fis-result">
            <div className="fis-score-line">
              <span>Skor kelayakan kandidat</span>
              <strong aria-live="polite">{decimal(result.score)}</strong>
            </div>
            <p className="panel-caption">
              Model{" "}
              {model === "gwo" ? `GWO · ${data.dataset.label}` : "MF awal"} ·
              MIN untuk kekuatan aturan, MAX untuk agregasi.
            </p>
            <div className="fis-visual-grid">
              <section className="fis-visual">
                <h3>Derajat keanggotaan input</h3>
                <Chart
                  config={degrees}
                  label="Derajat keanggotaan input"
                  compact
                />
                <DataTable
                  rows={Object.entries(result.degrees)}
                  columns={[
                    {
                      label: "Input",
                      render: ([key]) => inputLabels[key as InputVariable],
                    },
                    {
                      label: "Rendah / dekat / sedikit",
                      render: ([, group]) => decimal(Object.values(group)[0]),
                    },
                    {
                      label: "Sedang",
                      render: ([, group]) => decimal(Object.values(group)[1]),
                    },
                    {
                      label: "Tinggi / jauh / banyak",
                      render: ([, group]) => decimal(Object.values(group)[2]),
                    },
                  ]}
                />
              </section>
              <section className="fis-visual">
                <h3>Output dan titik centroid</h3>
                <Chart
                  config={output}
                  label="Agregasi output dan centroid"
                  compact
                />
                <DataDetails title="Lihat nilai output">
                  <DataTable
                    rows={result.x
                      .filter((_, i) => i % 25 === 0)
                      .map((x) => ({
                        x,
                        y: result.aggregate[
                          Math.round(x * (result.x.length - 1))
                        ],
                      }))}
                    columns={[
                      { label: "Skor output", render: (r) => decimal(r.x) },
                      { label: "Agregasi", render: (r) => decimal(r.y) },
                    ]}
                  />
                </DataDetails>
              </section>
            </div>
            <h3 className="fis-active-heading">Aturan yang aktif</h3>
            <DataTable
              rows={result.rules
                .filter((rule) => rule.strength > 0)
                .sort((a, b) => b.strength - a.strength)}
              columns={[
                { label: "Aturan", render: (r) => `R${r.index}` },
                ...ruleColumns,
                { label: "Kekuatan MIN", render: (r) => decimal(r.strength) },
              ]}
            />
          </div>
        </div>
      </Panel>
      <Panel
        title="Basis aturan Mamdani"
        caption="Semua kombinasi energi × jarak × tetangga. Konsekuen diambil langsung dari server."
      >
        <DataTable
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
