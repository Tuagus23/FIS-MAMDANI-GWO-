import type {
  ChartConfiguration,
  ChartOptions,
  ScriptableContext,
} from "chart.js";
import type { DashboardData, HistoryRow, Summary } from "./types";
import { colors, protocols, shapes, milestone } from "./data";
export function chartOptions(yLabel: string): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#53665f",
          usePointStyle: true,
          boxWidth: 10,
          padding: 16,
          font: { size: 13 },
        },
      },
      tooltip: { backgroundColor: "#193832", padding: 10 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#53665f", maxTicksLimit: 8 },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        title: { display: !!yLabel, text: yLabel, color: "#53665f" },
        grid: { color: "#e4eae5" },
        ticks: { color: "#53665f" },
        border: { display: false },
      },
    },
  };
}
export function lifetimeConfig(
  rows: Summary[],
  horizon: number,
): ChartConfiguration {
  const keys = ["fnd", "hnd", "lnd"] as const;
  return {
    type: "bar",
    data: {
      labels: ["FND", "HND", "LND"],
      datasets: rows.map((row) => ({
        label: row.protocol,
        data: keys.map((key) => row[key] ?? horizon),
        backgroundColor: colors[row.protocol],
        borderRadius: 4,
        maxBarThickness: 28,
      })),
    },
    options: {
      ...chartOptions("Ronde"),
      plugins: {
        ...chartOptions("").plugins,
        tooltip: {
          callbacks: {
            label(ctx) {
              const row = rows[ctx.datasetIndex];
              return `${row.protocol}: ${milestone(row[keys[ctx.dataIndex]], horizon)}`;
            },
          },
        },
      },
    },
  };
}
export function historyConfig(rows: HistoryRow[]): ChartConfiguration {
  const rounds = [...new Set(rows.map((row) => row.round_number))].sort(
    (a, b) => a - b,
  );
  return {
    type: "line",
    data: {
      labels: rounds,
      datasets: protocols.map((protocol) => {
        const values = new Map(
          rows
            .filter((row) => row.protocol === protocol)
            .map((row) => [row.round_number, row.alive_nodes]),
        );
        return {
          label: protocol,
          data: rounds.map((round) => values.get(round) ?? null),
          borderColor: colors[protocol],
          backgroundColor: colors[protocol],
          pointStyle: shapes[protocol],
          borderWidth: 2.5,
          pointRadius: (ctx: ScriptableContext<"line">) =>
            ctx.dataIndex % 150 === 0 ? 3 : 0,
          pointHoverRadius: 5,
          stepped: true,
          spanGaps: false,
        };
      }),
    },
    options: chartOptions("Node hidup"),
  };
}
export function validationConfig(data: DashboardData): ChartConfiguration {
  const rows = data.validation.filter((row) =>
    ["FND", "HND", "LND"].includes(row.metric),
  );
  return {
    type: "bar",
    data: {
      labels: rows.map((row) => row.metric),
      datasets: (["FUZZY", "GWO"] as const).map((protocol) => ({
        label: protocol,
        data: rows.map((row) => row[`${protocol}_mean`]),
        backgroundColor: colors[protocol],
        borderRadius: 4,
        maxBarThickness: 28,
      })),
    },
    options: chartOptions("Rata-rata ronde"),
  };
}
