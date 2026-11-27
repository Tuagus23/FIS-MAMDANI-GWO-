"use client";
import { useMemo, useRef, useState } from "react";
import type { ChartConfiguration, Plugin } from "chart.js";
import type { NetworkTopology, TopologyCollection } from "@/lib/types";
import { decimal } from "@/lib/data";
import { chartOptions } from "@/lib/charts";
import { Chart } from "./chart";
import { DataDetails, DataTable, Panel } from "./ui";

type MapPoint = { x: number; y: number; label: string; shortLabel: string };
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const nodeLabels: Plugin = {
  id: "networkNodeLabels",
  beforeDraw(chart) {
    chart.ctx.save();
    chart.ctx.fillStyle = "#ffffff";
    chart.ctx.fillRect(0, 0, chart.width, chart.height);
    chart.ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const marks = chart.data.datasets
      .flatMap((dataset, datasetIndex) =>
        chart.getDatasetMeta(datasetIndex).data.map((point, index) => ({
          x: point.x,
          y: point.y,
          data: dataset.data[index] as MapPoint,
        })),
      )
      .reverse();
    const occupied: Box[] = marks.map(({ x, y }) => ({
      x: x - 7,
      y: y - 7,
      width: 14,
      height: 14,
    }));
    ctx.save();
    ctx.font = '600 13px Manrope, "Segoe UI", sans-serif';
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    for (const mark of marks) {
      const width = ctx.measureText(mark.data.shortLabel).width + 4;
      const candidates = [10, 22, 36, 50].flatMap((distance) =>
        [
          [distance, -distance - 13],
          [-distance - width, -distance - 13],
          [distance, distance],
          [-distance - width, distance],
        ].map(([dx, dy]) => ({
          x: mark.x + dx,
          y: mark.y + dy,
          width,
          height: 17,
        })),
      );
      const penalty = (box: Box) =>
        occupied.filter((other) => overlaps(box, other)).length +
        (box.x < chartArea.left ||
        box.x + width > chartArea.right ||
        box.y < chartArea.top ||
        box.y + box.height > chartArea.bottom
          ? 100
          : 0);
      const chosen = candidates.reduce((best, box) =>
        penalty(box) < penalty(best) ? box : best,
      );
      occupied.push(chosen);
      ctx.beginPath();
      ctx.strokeStyle = "#82978d";
      ctx.lineWidth = 0.75;
      ctx.moveTo(mark.x, mark.y);
      ctx.lineTo(
        Math.max(chosen.x, Math.min(mark.x, chosen.x + width)),
        chosen.y + 7,
      );
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(mark.data.shortLabel, chosen.x + 2, chosen.y + 2);
      ctx.fillStyle = "#193832";
      ctx.fillText(mark.data.shortLabel, chosen.x + 2, chosen.y + 2);
    }
    ctx.restore();
  },
};

function topologyChart(layout: NetworkTopology): ChartConfiguration {
  const defaults = chartOptions("Posisi Y (meter)");
  const station = layout.base_station;
  const stationPoint: MapPoint = {
    x: station.x_m,
    y: station.y_m,
    label: "BS",
    shortLabel: "BS",
  };
  return {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Node sensor",
          data: layout.nodes.map((node) => ({
            x: node.x_m,
            y: node.y_m,
            label: `Node ${node.node_id}`,
            shortLabel: String(node.node_id),
          })),
          backgroundColor: "#007f6b",
          pointRadius: 5,
          pointHoverRadius: 7,
          pointStyle: "circle",
        },
        {
          label: "BS (Base Station)",
          data: [stationPoint],
          backgroundColor: "#a94b15",
          pointRadius: 8,
          pointHoverRadius: 10,
          pointStyle: "rect",
        },
      ],
    },
    plugins: [nodeLabels],
    options: {
      ...defaults,
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        ...defaults.plugins,
        title: {
          display: true,
          text: `Seed ${layout.seed} · ${layout.nodes.length} node sensor`,
          color: "#193832",
          font: { size: 14, weight: 600 },
          padding: { bottom: 16 },
        },
        tooltip: {
          callbacks: {
            title: (items) => (items[0].raw as MapPoint).label,
            label: (item) => {
              const point = item.raw as MapPoint;
              return `X ${decimal(point.x)} m · Y ${decimal(point.y)} m`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          grid: { color: "#e4eae5" },
          min: Math.min(0, station.x_m),
          max: Math.max(layout.width_m, station.x_m),
          title: { display: true, text: "Posisi X (meter)" },
          ticks: { stepSize: 25, maxTicksLimit: 5 },
        },
        y: {
          type: "linear",
          grid: { color: "#e4eae5" },
          title: { display: true, text: "Posisi Y (meter)" },
          min: Math.min(0, station.y_m),
          max: Math.max(layout.height_m, station.y_m),
          ticks: { stepSize: 25, maxTicksLimit: 5 },
        },
      },
    },
  };
}

export function NetworkTopologyPanel({
  topologies,
  validation = false,
}: {
  topologies?: TopologyCollection;
  validation?: boolean;
}) {
  const initialSeed = validation
    ? topologies?.validation_seeds[0]
    : topologies?.experiment_seed;
  const [selected, setSelected] = useState(initialSeed);
  const [message, setMessage] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const layout =
    topologies?.layouts.find((item) => item.seed === selected) ??
    topologies?.layouts[0];
  const config = useMemo(
    () => (layout ? topologyChart(layout) : null),
    [layout],
  );
  if (!topologies || !layout || !config) return null;
  const groups = [
    { name: "Eksperimen Ringkasan", seeds: [topologies.experiment_seed] },
    {
      name: "Kalibrasi GWO",
      seeds: topologies.fitness_seeds.filter(
        (seed) => seed !== topologies.experiment_seed,
      ),
    },
    { name: "Validasi model", seeds: topologies.validation_seeds },
  ];
  const usage = [
    layout.seed === topologies.experiment_seed ? "Eksperimen Ringkasan" : "",
    topologies.fitness_seeds.includes(layout.seed) ? "Kalibrasi GWO" : "",
    topologies.validation_seeds.includes(layout.seed) ? "Validasi model" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const rows = [
    ...layout.nodes.map((node) => ({
      label: `Node ${node.node_id}`,
      x: node.x_m,
      y: node.y_m,
    })),
    { label: "BS", x: layout.base_station.x_m, y: layout.base_station.y_m },
  ];
  const download = async () => {
    const canvas = mapRef.current?.querySelector("canvas");
    const { default: ChartJs } = await import("chart.js/auto");
    if (!canvas || !ChartJs.getChart(canvas)) {
      setMessage("Gambar sedang disiapkan. Coba unduh kembali sebentar.");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage("Gambar belum dapat diunduh. Coba lagi sebentar.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `posisi_node_seed_${layout.seed}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("");
    }, "image/png");
  };
  return (
    <Panel
      title="Posisi awal node dan BS"
      caption="Angka pada gambar menunjukkan ID node sensor. BS (Base Station) menerima data jaringan. Pilih seed untuk melihat susunan posisi yang digunakan."
      action={
        <label className="network-seed-picker">
          <span>Seed posisi node</span>
          <select
            className="dataset-select"
            value={layout.seed}
            onChange={(event) => {
              setSelected(Number(event.target.value));
              setMessage("");
            }}
          >
            {groups
              .filter((group) => group.seeds.length)
              .map((group) => (
                <optgroup label={group.name} key={group.name}>
                  {group.seeds.map((seed) => (
                    <option key={seed} value={seed}>
                      Seed {seed}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
      }
    >
      <div className="network-map" ref={mapRef}>
        <Chart
          config={config}
          label={`Posisi ${layout.nodes.length} node sensor bernomor dan BS pada seed ${layout.seed}`}
        />
      </div>
      <div className="network-map-footer">
        <p className="panel-caption" aria-live="polite">
          {usage}. BS di X {decimal(layout.base_station.x_m)} m, Y{" "}
          {decimal(layout.base_station.y_m)} m.
        </p>
        <button className="button button-secondary" onClick={download}>
          Unduh gambar PNG
        </button>
      </div>
      {message && (
        <p className="table-footnote" role="status">
          {message}
        </p>
      )}
      <DataDetails title="Lihat koordinat node dan BS">
        <DataTable
          label={`Koordinat node dan BS · Seed ${layout.seed}`}
          rows={rows}
          columns={[
            { label: "Node", render: (row) => row.label },
            { label: "X (meter)", render: (row) => decimal(row.x) },
            { label: "Y (meter)", render: (row) => decimal(row.y) },
          ]}
        />
      </DataDetails>
    </Panel>
  );
}
