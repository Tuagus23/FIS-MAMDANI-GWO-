const state = { datasets: [], datasetId: "results", dashboard: null, simulation: null, charts: {}, view: "hasil" };

const viewText = {
  hasil: {
    title: "Ringkasan hasil",
    eyebrow: "HASIL TERSIMPAN",
    description: "Membandingkan umur jaringan dan keberhasilan pengiriman paket pada setiap protokol.",
    breadcrumb: "RINGKASAN HASIL",
  },
  validasi: {
    title: "Validasi model",
    eyebrow: "HASIL VALIDASI",
    description: "Membaca performa model FUZZY dan GWO pada topologi yang tidak digunakan dalam optimasi.",
    breadcrumb: "VALIDASI MODEL",
  },
  membership: {
    title: "Fungsi keanggotaan",
    eyebrow: "PARAMETER FUZZY",
    description: "Melihat cara energi, jarak, dan jumlah tetangga diterjemahkan menjadi skor kandidat cluster head.",
    breadcrumb: "FUNGSI KEANGGOTAAN",
  },
  simulasi: {
    title: "Simulasi baru",
    eyebrow: "EKSPERIMEN INTERAKTIF",
    description: "Ubah parameter jaringan dan lihat perbandingan tiga protokol pada topologi yang sama.",
    breadcrumb: "SIMULASI BARU",
  },
};

const protocolColors = { FUZZY: "#24766b", LEACH: "#6687a0", GWO: "#d8904e" };
const axisColor = "#83908b";
const gridColor = "#edf1ed";
const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatInteger(value) {
  return value === null || value === undefined ? "Belum tercapai" : numberFormat.format(value);
}

function formatPercent(value) {
  return value === null || value === undefined ? "—" : `${decimalFormat.format(value)}%`;
}

function formatDecimal(value) {
  return value === null || value === undefined ? "—" : decimalFormat.format(value);
}

function setView(view) {
  if (!viewText[view]) return;
  state.view = view;
  $$(".view-section").forEach((section) => section.classList.toggle("hidden", section.id !== `view-${view}`));
  $$("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const copy = viewText[view];
  $("#pageTitle").textContent = copy.title;
  $("#pageEyebrow").textContent = copy.eyebrow;
  $("#pageDescription").textContent = copy.description;
  $("#breadcrumb").innerHTML = `RUANG ANALISIS <span class="mx-1 text-slate-300">/</span> <span class="text-ink">${escapeHtml(copy.breadcrumb)}</span>`;
  $("#downloadPrimary").classList.toggle("hidden", view !== "hasil");
  if (view === "hasil") setTimeout(() => renderLifetimeChart(state.dashboard?.summary || []), 0);
  if (view === "validasi") setTimeout(() => renderValidationChart(state.dashboard?.validation || []), 0);
  if (view === "membership") setTimeout(() => renderMembershipCharts(state.dashboard?.membership), 0);
  if (view === "simulasi" && state.simulation) setTimeout(() => renderSimulationChart(state.simulation.history), 0);
}

function setError(message) {
  const banner = $("#errorBanner");
  banner.textContent = message;
  banner.classList.toggle("hidden", !message);
}

function setLoading(isLoading) {
  $("#loadingState").classList.toggle("hidden", !isLoading);
}

function makeTable(headers, rows) {
  if (!rows.length) return '<p class="table-footnote">Tidak ada baris untuk ditampilkan.</p>';
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header.label)}</th>`).join("");
  const body = rows.map((row) => `<tr>${headers.map((header) => `<td>${header.render ? header.render(row[header.key], row) : escapeHtml(row[header.key])}</td>`).join("")}</tr>`).join("");
  return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function protocolCell(value) {
  const name = String(value || "");
  const color = name === "LEACH" ? "leach" : name === "GWO" ? "gwo" : "";
  return `<span class="protocol-name"><span class="protocol-dot ${color}" aria-hidden="true"></span>${escapeHtml(name)}</span>`;
}

function chartOptions(yLabel, legend = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: legend,
        position: "bottom",
        labels: { color: "#64736f", boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", padding: 16, font: { size: 10 } },
      },
      tooltip: { backgroundColor: "#18332f", padding: 10, titleFont: { size: 11 }, bodyFont: { size: 11 }, displayColors: true },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: axisColor, maxTicksLimit: 8, font: { size: 10 } }, border: { display: false } },
      y: { beginAtZero: true, title: { display: Boolean(yLabel), text: yLabel, color: axisColor, font: { size: 10, weight: "normal" } }, grid: { color: gridColor }, ticks: { color: axisColor, font: { size: 10 } }, border: { display: false } },
    },
  };
}

function replaceChart(key, canvasId, config) {
  if (!window.Chart) {
    setError("Grafik tidak dapat dimuat. Tabel data tetap tersedia.");
    return;
  }
  if (state.charts[key]) state.charts[key].destroy();
  state.charts[key] = new Chart(document.getElementById(canvasId), config);
}

function toggleChartEmpty(canvasId, emptyId, isEmpty) {
  document.getElementById(canvasId).closest(".chart-frame").classList.toggle("hidden", isEmpty);
  document.getElementById(emptyId).classList.toggle("hidden", !isEmpty);
}

function renderSummary(data) {
  const rows = data || [];
  const empty = rows.length === 0;
  $("#summaryEmpty").classList.toggle("hidden", !empty);
  $("#summaryMetrics").classList.toggle("hidden", empty);
  $("#summaryTable").innerHTML = makeTable([
    { key: "protocol", label: "Protokol", render: protocolCell },
    { key: "fnd", label: "FND", render: formatInteger },
    { key: "hnd", label: "HND", render: formatInteger },
    { key: "lnd", label: "LND", render: formatInteger },
    { key: "pdr_total_pct", label: "PDR", render: formatPercent },
    { key: "last_round", label: "Ronde akhir", render: formatInteger },
  ], rows);

  if (!empty) {
    const pdrs = rows.map((row) => Number(row.pdr_total_pct)).filter(Number.isFinite);
    const fnds = rows.map((row) => Number(row.fnd)).filter(Number.isFinite);
    const lnds = rows.map((row) => Number(row.lnd)).filter(Number.isFinite);
    const metrics = [
      { label: "Rata-rata PDR", value: pdrs.length ? formatPercent(pdrs.reduce((a, b) => a + b, 0) / pdrs.length) : "—", sub: "pembacaan diterima", accent: "" },
      { label: "FND tercepat", value: fnds.length ? formatInteger(Math.min(...fnds)) : "—", sub: "node pertama mati", accent: "orange" },
      { label: "Umur terpanjang", value: lnds.length ? formatInteger(Math.max(...lnds)) : "—", sub: "node terakhir mati", accent: "blue" },
      { label: "Protokol", value: numberFormat.format(rows.length), sub: "metode dibandingkan", accent: "ink" },
    ];
    $("#summaryMetrics").innerHTML = metrics.map((metric) => `<article class="metric-card"><p class="metric-label">${metric.label}</p><p class="metric-value">${metric.value}</p><p class="metric-sub">${metric.sub}</p><div class="metric-accent ${metric.accent}" aria-hidden="true"></div></article>`).join("");
  }

  renderLifetimeChart(rows);
}

function renderLifetimeChart(rows) {
  const lifetimeRows = rows.filter((row) => ["FUZZY", "LEACH", "GWO"].includes(row.protocol));
  const hasValues = lifetimeRows.some((row) => row.fnd !== null || row.hnd !== null || row.lnd !== null);
  toggleChartEmpty("lifetimeChart", "lifetimeChartEmpty", !hasValues);
  if (!hasValues) return;
  const labels = ["FND", "HND", "LND"];
  const fields = ["fnd", "hnd", "lnd"];
  replaceChart("lifetime", "lifetimeChart", {
    type: "bar",
    data: {
      labels,
      datasets: ["FUZZY", "LEACH", "GWO"].map((protocol) => {
        const row = lifetimeRows.find((item) => item.protocol === protocol);
        return { label: protocol, data: fields.map((field) => row?.[field] ?? null), backgroundColor: protocolColors[protocol], borderRadius: 4, maxBarThickness: 28 };
      }),
    },
    options: { ...chartOptions("Ronde"), scales: { ...chartOptions("Ronde").scales, y: { ...chartOptions("Ronde").scales.y, suggestedMax: Math.max(10, ...lifetimeRows.flatMap((row) => [row.fnd || 0, row.hnd || 0, row.lnd || 0])) * 1.12 } } },
  });
}

function renderHistoryChart(rows) {
  const history = rows || [];
  const protocols = ["FUZZY", "LEACH", "GWO"].filter((protocol) => history.some((row) => row.protocol === protocol));
  const hasValues = history.length > 0 && protocols.length > 0;
  toggleChartEmpty("historyChart", "historyChartEmpty", !hasValues);
  if (!hasValues) return;
  const rounds = [...new Set(history.map((row) => row.round_number))].sort((a, b) => a - b);
  replaceChart("history", "historyChart", {
    type: "line",
    data: {
      labels: rounds,
      datasets: protocols.map((protocol) => {
        const values = new Map(history.filter((row) => row.protocol === protocol).map((row) => [row.round_number, row.alive_nodes]));
        return { label: protocol, data: rounds.map((round) => values.has(round) ? values.get(round) : null), borderColor: protocolColors[protocol], backgroundColor: protocolColors[protocol], borderWidth: 2, pointRadius: 0, pointHitRadius: 7, tension: 0.16, spanGaps: false };
      }),
    },
    options: chartOptions("Node hidup"),
  });
}

function renderValidation(rows) {
  const data = rows || [];
  const metrics = data.filter((row) => ["FND", "HND", "LND", "PDR_pct", "lifetime_index"].includes(row.metric));
  const empty = data.length === 0;
  $("#validationEmpty").classList.toggle("hidden", !empty);
  $("#validationSeedCount").textContent = data[0]?.seed_count ?? "—";
  $("#validationTable").innerHTML = makeTable([
    { key: "metric", label: "Metrik", render: (value) => escapeHtml(({ PDR_pct: "PDR", lifetime_index: "Indeks umur" })[value] || value) },
    { key: "FUZZY_mean", label: "FUZZY", render: (value, row) => row.metric === "PDR_pct" ? formatPercent(value) : formatDecimal(value) },
    { key: "GWO_mean", label: "GWO", render: (value, row) => row.metric === "PDR_pct" ? formatPercent(value) : formatDecimal(value) },
    { key: "mean_delta_GWO_minus_FUZZY", label: "Selisih GWO − FUZZY", render: (value) => value === null || value === undefined ? "—" : `${Number(value) > 0 ? "+" : ""}${formatDecimal(value)}` },
    { key: "GWO_wins", label: "Seed dimenangi GWO", render: formatInteger },
    { key: "FUZZY_wins", label: "Seed dimenangi FUZZY", render: formatInteger },
  ], metrics);
  renderValidationChart(data);
}

function renderValidationChart(rows) {
  const data = rows.filter((row) => ["FND", "HND", "LND"].includes(row.metric));
  const empty = data.length === 0;
  toggleChartEmpty("validationChart", "validationChartEmpty", empty);
  if (empty) return;
  const options = chartOptions("Rata-rata ronde");
  replaceChart("validation", "validationChart", {
    type: "bar",
    data: {
      labels: data.map((row) => row.metric),
      datasets: [
        { label: "FUZZY", data: data.map((row) => row.FUZZY_mean), backgroundColor: protocolColors.FUZZY, borderRadius: 4, maxBarThickness: 28 },
        { label: "GWO", data: data.map((row) => row.GWO_mean), backgroundColor: protocolColors.GWO, borderRadius: 4, maxBarThickness: 28 },
      ],
    },
    options,
  });
}

function membershipDegree(shape, points, x) {
  if (shape === "tri") {
    const [a, b, c] = points;
    const left = b === a ? (x >= a ? 1 : 0) : (x - a) / (b - a);
    const right = c === b ? (x <= c ? 1 : 0) : (c - x) / (c - b);
    return Math.max(0, Math.min(1, left, right));
  }
  const [a, b, c, d] = points;
  const left = b === a ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const right = d === c ? (x <= d ? 1 : 0) : (d - x) / (d - c);
  return Math.max(0, Math.min(1, left, right));
}

function renderMembershipCharts(membership) {
  const grid = $("#membershipGrid");
  if (!membership) {
    $("#membershipEmpty").classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  $("#membershipEmpty").classList.add("hidden");
  const definitions = [
    { key: "energy", title: "Energi sisa", unit: "rasio energi", min: 0, max: 1 },
    { key: "distance", title: "Jarak ke base station", unit: "meter", min: 0, max: 100 },
    { key: "neighbors", title: "Jumlah tetangga", unit: "node", min: 0, max: 20 },
    { key: "output", title: "Skor kelayakan", unit: "skor Mamdani", min: 0, max: 1 },
  ];
  grid.innerHTML = definitions.map((item) => `<article class="membership-card"><h3>${item.title}</h3><p>${item.unit}</p><div class="membership-chart"><canvas id="mf-${item.key}" role="img" aria-label="Grafik fungsi keanggotaan ${item.title.toLowerCase()}"></canvas></div></article>`).join("");
  const colors = ["#24766b", "#d8904e", "#6687a0"];
  definitions.forEach((definition) => {
    const functions = membership[definition.key] || {};
    const values = Array.from({ length: 121 }, (_, index) => definition.min + (definition.max - definition.min) * index / 120);
    const sets = Object.entries(functions);
    replaceChart(`mf-${definition.key}`, `mf-${definition.key}`, {
      type: "line",
      data: {
        labels: values.map((value) => Number(value.toFixed(2))),
        datasets: sets.map(([label, spec], index) => ({ label, data: values.map((value) => membershipDegree(spec.shape, spec.points, value)), borderColor: colors[index % colors.length], backgroundColor: colors[index % colors.length], borderWidth: 2, pointRadius: 0, tension: 0.12 })),
      },
      options: {
        ...chartOptions("Derajat keanggotaan"),
        plugins: { ...chartOptions("").plugins, legend: { ...chartOptions("").plugins.legend, labels: { ...chartOptions("").plugins.legend.labels, padding: 11 } } },
        scales: {
          x: { ...chartOptions("").scales.x, ticks: { ...chartOptions("").scales.x.ticks, maxTicksLimit: 5 } },
          y: { ...chartOptions("").scales.y, min: 0, max: 1, ticks: { ...chartOptions("").scales.y.ticks, stepSize: 0.25 } },
        },
      },
    });
  });
}

function updateDatasetDescription(dataset) {
  $("#datasetDescription").textContent = dataset?.description || "Data eksperimen yang dipilih.";
}

async function loadDashboard(datasetId = state.datasetId) {
  state.datasetId = datasetId;
  setError("");
  setLoading(true);
  try {
    const response = await fetch(`/api/dashboard?dataset=${encodeURIComponent(datasetId)}`, { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Data eksperimen tidak dapat dimuat.");
    state.dashboard = data;
    updateDatasetDescription(data.dataset);
    renderSummary(data.summary);
    renderHistoryChart(data.history);
    renderValidation(data.validation);
    renderMembershipCharts(data.membership);
  } catch (error) {
    setError(error.message || "Tidak dapat menghubungi server.");
  } finally {
    setLoading(false);
  }
}

function setSimulationBusy(busy) {
  const button = $("#runSimulation");
  button.disabled = busy;
  $(".button-spinner").classList.toggle("hidden", !busy);
  $(".button-label").textContent = busy ? "Simulasi berjalan…" : "Jalankan simulasi";
  $("#simulationStatus").textContent = busy ? "sedang diproses" : "menunggu simulasi";
  $("#simulationNotice").classList.toggle("hidden", !busy);
  $("#simulationNotice").classList.remove("notice-error", "notice-success");
  if (busy) $("#simulationNotice").textContent = "Simulasi sedang dihitung. Mohon tunggu hingga hasil muncul.";
}

function renderSimulation(result) {
  state.simulation = result;
  $("#simulationPlaceholder").classList.add("hidden");
  $("#simulationResults").classList.remove("hidden");
  $("#simulationStatus").textContent = `${numberFormat.format(result.config.nodes)} node · ${numberFormat.format(result.config.rounds)} ronde`;
  const bestLifetime = [...result.summary].sort((a, b) => (b.lnd || 0) - (a.lnd || 0))[0];
  const avgPdr = result.summary.reduce((sum, row) => sum + Number(row.pdr_total_pct || 0), 0) / Math.max(result.summary.length, 1);
  $("#simulationMetrics").innerHTML = [
    { label: "Umur terpanjang", value: formatInteger(bestLifetime?.lnd), hint: bestLifetime?.protocol || "—" },
    { label: "Rata-rata PDR", value: formatPercent(avgPdr), hint: "tiga protokol" },
    { label: "Seed", value: formatInteger(result.config.seed), hint: "topologi" },
  ].map((metric) => `<div class="sim-metric"><span>${metric.label}</span><strong>${metric.value}</strong><span class="mt-1">${metric.hint}</span></div>`).join("");
  $("#simulationTable").innerHTML = makeTable([
    { key: "protocol", label: "Protokol", render: protocolCell },
    { key: "fnd", label: "FND", render: formatInteger },
    { key: "hnd", label: "HND", render: formatInteger },
    { key: "lnd", label: "LND", render: formatInteger },
    { key: "pdr_total_pct", label: "PDR", render: formatPercent },
  ], result.summary);
  renderSimulationChart(result.history);
}

function renderSimulationChart(rows) {
  if (!rows?.length) return;
  const rounds = [...new Set(rows.map((row) => row.round_number))].sort((a, b) => a - b);
  replaceChart("simulation", "simulationChart", {
    type: "line",
    data: {
      labels: rounds,
      datasets: ["FUZZY", "LEACH", "GWO"].map((protocol) => {
        const values = new Map(rows.filter((row) => row.protocol === protocol).map((row) => [row.round_number, row.alive_nodes]));
        return { label: protocol, data: rounds.map((round) => values.has(round) ? values.get(round) : null), borderColor: protocolColors[protocol], backgroundColor: protocolColors[protocol], borderWidth: 2, pointRadius: 0, pointHitRadius: 7, tension: 0.16, spanGaps: false };
      }),
    },
    options: chartOptions("Node hidup"),
  });
}

function toCsv(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.map(quote).join(","), ...rows.map((row) => headers.map((key) => quote(row[key])).join(","))].join("\r\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSummary() {
  downloadFile("protocol_summary.csv", toCsv(state.dashboard?.summary || []), "text/csv;charset=utf-8");
}

function downloadValidation() {
  downloadFile("validation_summary.csv", toCsv(state.dashboard?.validation || []), "text/csv;charset=utf-8");
}

function downloadMembership() {
  const value = state.dashboard?.membership;
  if (value) downloadFile("membership_gwo.json", JSON.stringify(value, null, 2), "application/json;charset=utf-8");
}

function bindEvents() {
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#datasetSelect").addEventListener("change", (event) => loadDashboard(event.target.value));
  $("#downloadPrimary").addEventListener("click", downloadSummary);
  $("#downloadValidation").addEventListener("click", downloadValidation);
  $("#downloadMembership").addEventListener("click", downloadMembership);
  $("#downloadSimulation").addEventListener("click", () => {
    downloadFile("round_metrics.csv", toCsv(state.simulation?.history || []), "text/csv;charset=utf-8");
  });
  $("#nodesInput").addEventListener("input", (event) => {
    $("#headsInput").max = Math.min(10, Number(event.target.value) || 10);
  });
  $("#simulationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    $("#simulationNotice").classList.add("hidden");
    const payload = {
      nodes: Number($("#nodesInput").value),
      rounds: Number($("#roundsInput").value),
      seed: Number($("#seedInput").value),
      cluster_head_count: Number($("#headsInput").value),
    };
    if (!event.currentTarget.reportValidity()) return;
    setSimulationBusy(true);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Simulasi tidak dapat dijalankan.");
      renderSimulation(result);
      $("#simulationNotice").textContent = "Simulasi selesai. Anda dapat mengunduh metrik per ronde.";
      $("#simulationNotice").classList.remove("hidden");
      $("#simulationNotice").classList.add("notice-success");
      $("#simulationStatus").textContent = "selesai";
    } catch (error) {
      $("#simulationNotice").textContent = error.message || "Simulasi gagal dijalankan.";
      $("#simulationNotice").classList.remove("hidden");
      $("#simulationNotice").classList.add("notice-error");
      $("#simulationStatus").textContent = "gagal";
    } finally {
      $("#runSimulation").disabled = false;
      $(".button-spinner").classList.add("hidden");
      $(".button-label").textContent = "Jalankan simulasi";
    }
  });
}

async function start() {
  bindEvents();
  try {
    const response = await fetch("/api/datasets", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Daftar dataset tidak dapat dimuat.");
    state.datasets = data.datasets;
    state.datasetId = data.default || "results";
    $("#datasetSelect").innerHTML = state.datasets.map((dataset) => `<option value="${escapeHtml(dataset.id)}">${escapeHtml(dataset.label)}</option>`).join("");
    $("#datasetSelect").value = state.datasetId;
    await loadDashboard(state.datasetId);
  } catch (error) {
    setLoading(false);
    setError(error.message || "Tidak dapat menghubungi server. Jalankan aplikasi dengan perintah python app.py.");
  }
}

start();

