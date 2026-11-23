const state = { datasets: [], datasetId: "results", dashboard: null, simulation: null, gwoProcess: null, gwoProcessLoading: false, charts: {}, view: "hasil", authClient: null, dashboardRequestId: 0 };
const inviteType = new URLSearchParams(window.location.hash.slice(1)).get("type")
  || new URLSearchParams(window.location.search).get("type");

const viewText = {
  hasil: {
    title: "Ringkasan",
    description: "Bandingkan umur jaringan dan keberhasilan pengiriman tiga protokol.",
    breadcrumb: "Ringkasan",
  },
  validasi: {
    title: "Validasi model",
    description: "Membandingkan model FUZZY dan GWO pada seed uji yang terpisah dari seed kalibrasi.",
    breadcrumb: "Validasi model",
  },
  membership: {
    title: "Fungsi keanggotaan",
    description: "Melihat cara energi, jarak, dan jumlah tetangga diterjemahkan menjadi skor kandidat cluster head.",
    breadcrumb: "Fungsi keanggotaan",
  },
  gwo: {
    title: "Proses GWO",
    description: "Telusuri cara Gray Wolf Optimizer menyetel titik fungsi keanggotaan dan memilih solusi terbaik.",
    breadcrumb: "Proses GWO",
  },
  fis: {
    title: "Proses FIS Mamdani",
    description: "Ikuti perubahan energi, jarak, dan jumlah tetangga menjadi skor kandidat cluster head.",
    breadcrumb: "Proses FIS Mamdani",
  },
  anggota: {
    title: "Anggota kelompok",
    description: "Kenali tim dan peran setiap anggota dalam pengembangan proyek Fuzzy CH WSN.",
    breadcrumb: "Anggota kelompok",
  },
  simulasi: {
    title: "Simulasi baru",
    description: "Ubah parameter jaringan dan lihat perbandingan tiga protokol pada topologi yang sama.",
    breadcrumb: "Simulasi baru",
  },
};

const protocolColors = { FUZZY: "#00765e", LEACH: "#3568a8", GWO: "#b34d16" };
const protocolStyles = {
  FUZZY: { pointStyle: "circle" },
  LEACH: { pointStyle: "rect" },
  GWO: { pointStyle: "triangle" },
};
const membershipInitialColors = ["#075985", "#9F1239", "#6D28D9"];
const membershipOptimizedColors = ["#0F766E", "#C2410C", "#166534"];
const axisColor = "#53665f";
const gridColor = "#e4eae5";
const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function redirectToLogin(status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  window.location.replace(`/login.html${query}`);
}

async function authenticatedFetch(url, options = {}) {
  const { data, error } = await state.authClient.auth.getSession();
  const session = data?.session;
  if (error || !session) {
    redirectToLogin("expired");
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    await state.authClient.auth.signOut({ scope: "local" }).catch(() => {});
    redirectToLogin(response.status === 403 ? "access" : "expired");
  }
  return response;
}

async function readApiResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  let data = null;
  if (contentType.includes("json")) {
    try { data = JSON.parse(body); } catch { data = null; }
  }
  if (!response.ok) {
    if (response.status === 413) throw new Error("Permintaan terlalu besar untuk diproses. Kurangi ukuran skenario lalu coba lagi.");
    if ([502, 503, 504].includes(response.status)) throw new Error("Server terlalu lama merespons atau sedang sibuk. Tunggu sebentar, lalu coba lagi.");
    throw new Error(data?.error || fallbackMessage);
  }
  if (!contentType.includes("json") || !data || typeof data !== "object") {
    throw new Error("Server mengirim respons yang tidak dapat dibaca. Muat ulang halaman dan coba lagi.");
  }
  return data;
}

function requestErrorMessage(error, fallback) {
  if (error?.name === "AbortError") return "Permintaan ke server melewati batas waktu. Coba lagi sebentar.";
  if (error instanceof TypeError) return "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.";
  return error?.message || fallback;
}

function setConnectionStatus(message, connected = true) {
  const status = $("#connectionState");
  $("#connectionText").textContent = message;
  status.classList.toggle("is-error", !connected);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatInteger(value) {
  const number = finiteNumber(value);
  return number === null ? "—" : numberFormat.format(number);
}

function formatPercent(value) {
  const number = finiteNumber(value);
  return number === null ? "—" : `${decimalFormat.format(number)}%`;
}

function formatDecimal(value) {
  const number = finiteNumber(value);
  return number === null ? "—" : decimalFormat.format(number);
}

function formatMilestone(value, row, horizon = state.dashboard?.horizon) {
  const number = finiteNumber(value);
  if (number !== null) return formatInteger(number);
  return horizon ? `> ${formatInteger(horizon)} (belum tercapai)` : "Tersensor";
}

function bestMetricRows(rows, key, censoredIsBest = false) {
  const eligible = rows.filter((row) => finiteNumber(row[key]) !== null || (censoredIsBest && row[key] === null));
  if (!eligible.length) return [];
  const score = (row) => finiteNumber(row[key]) ?? (censoredIsBest && row[key] === null ? Infinity : -Infinity);
  const bestScore = Math.max(...eligible.map(score));
  return eligible.filter((row) => score(row) === bestScore);
}

function setView(view, { updateHash = false } = {}) {
  if (!viewText[view]) return;
  if (updateHash && location.hash !== `#${view}`) {
    location.hash = view;
    return;
  }
  const previousView = state.view;
  state.view = view;
  $$(".view-section").forEach((section) => section.classList.toggle("hidden", section.id !== `view-${view}`));
  const activeSection = $(`#view-${view}`);
  activeSection.classList.remove("is-entering");
  if (previousView !== view && ["gwo", "fis"].includes(view)) {
    void activeSection.offsetWidth;
    activeSection.classList.add("is-entering");
  }
  $$("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const copy = viewText[view];
  $("#pageTitle").textContent = copy.title;
  $("#pageDescription").textContent = copy.description;
  $("#breadcrumb").innerHTML = `Ruang analisis <span class="mx-1 text-slate-300">/</span> <span class="text-ink">${escapeHtml(copy.breadcrumb)}</span>`;
  $("#downloadPrimary").toggleAttribute("hidden", view !== "hasil");
  window.dashboardMotion?.scrollToTop();
  if (!window.dashboardMotion) window.scrollTo({ top: 0, behavior: "auto" });
  window.dashboardMotion?.refresh();
  if (view === "hasil") setTimeout(() => renderLifetimeChart(state.dashboard?.summary || []), 0);
  if (view === "validasi") setTimeout(() => renderValidationChart(state.dashboard?.validation || []), 0);
  if (view === "membership") setTimeout(() => renderMembershipCharts(state.dashboard?.membership, state.dashboard?.membership_baseline, state.dashboard?.membership_ranges), 0);
  if (view === "gwo") loadGwoProcess();
  if (view === "fis") setTimeout(renderFisProcess, 0);
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
  const head = headers.map((header) => `<th scope="col">${header.markup || escapeHtml(header.label)}</th>`).join("");
  const body = rows.map((row) => `<tr>${headers.map((header) => `<td>${header.render ? header.render(row[header.key], row) : escapeHtml(row[header.key])}</td>`).join("")}</tr>`).join("");
  return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function protocolCell(value) {
  const name = String(value || "");
  const color = name.toLowerCase();
  return `<span class="protocol-name"><span class="protocol-symbol ${color}" aria-hidden="true"></span>${escapeHtml(name)}</span>`;
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
        labels: { color: "#53665f", boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 16, font: { size: 13 } },
      },
      tooltip: { backgroundColor: "#193832", padding: 10, titleFont: { size: 13 }, bodyFont: { size: 13 }, displayColors: true },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: axisColor, maxTicksLimit: 8, font: { size: 13 } }, border: { display: false } },
      y: { beginAtZero: true, title: { display: Boolean(yLabel), text: yLabel, color: axisColor, font: { size: 13, weight: "normal" } }, grid: { color: gridColor }, ticks: { color: axisColor, font: { size: 13 } }, border: { display: false } },
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
    { key: "fnd", label: "FND", markup: '<abbr title="Ronde saat node pertama mati; lebih besar berarti lebih baik">FND</abbr>', render: (value, row) => formatMilestone(value, row) },
    { key: "hnd", label: "HND", markup: '<abbr title="Ronde saat setidaknya separuh node mati">HND</abbr>', render: (value, row) => formatMilestone(value, row) },
    { key: "lnd", label: "LND", markup: '<abbr title="Ronde saat node terakhir mati; jika belum tercapai ditampilkan sebagai batas bawah">LND</abbr>', render: (value, row) => formatMilestone(value, row) },
    { key: "pdr_total_pct", label: "PDR", markup: '<abbr title="Rasio paket data yang berhasil diterima base station">PDR</abbr>', render: formatPercent },
    { key: "last_round", label: "Ronde akhir", markup: '<abbr title="Ronde simulasi terakhir yang tercatat">Ronde akhir</abbr>', render: formatInteger },
  ], rows);

  if (!empty) {
    const bestLnd = bestMetricRows(rows, "lnd", true);
    const bestPdr = bestMetricRows(rows, "pdr_total_pct");
    const bestFnd = bestMetricRows(rows, "fnd", true);
    const bestHnd = bestMetricRows(rows, "hnd", true);
    const bestSummary = (bestRows, key, label) => bestRows.length
      ? { label, value: escapeHtml(bestRows.map((row) => row.protocol).join(" + ")), sub: key === "pdr_total_pct" ? `${formatPercent(bestRows[0][key])} · PDR` : `${formatMilestone(bestRows[0][key], bestRows[0])} ronde · ${key.toUpperCase()}` }
      : { label, value: "—", sub: "Belum tersedia" };
    const metrics = [
      bestSummary(bestLnd, "lnd", "Umur terpanjang"),
      bestSummary(bestPdr, "pdr_total_pct", "PDR tertinggi"),
      bestSummary(bestFnd, "fnd", "FND tertinggi"),
      bestSummary(bestHnd, "hnd", "HND tertinggi"),
    ];
    $("#summaryMetrics").innerHTML = metrics.map((metric) => `<article class="metric-card"><p class="metric-label">${metric.label}</p><p class="metric-value">${metric.value}</p><p class="metric-sub">${metric.sub}</p></article>`).join("");
  }

  renderLifetimeChart(rows);
  window.dashboardMotion?.refresh();
}

function renderLifetimeChart(rows) {
  const lifetimeRows = rows.filter((row) => ["FUZZY", "LEACH", "GWO"].includes(row.protocol));
  const horizon = finiteNumber(state.dashboard?.horizon);
  const hasValues = lifetimeRows.some((row) => [row.fnd, row.hnd, row.lnd].some((value) => finiteNumber(value) !== null || (value === null && horizon !== null)));
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
        return { label: protocol, data: fields.map((field) => finiteNumber(row?.[field]) ?? (row?.[field] === null ? horizon : null)), backgroundColor: protocolColors[protocol], borderRadius: 4, maxBarThickness: 28 };
      }),
    },
    options: {
      ...chartOptions("Ronde"),
      plugins: { ...chartOptions("Ronde").plugins, tooltip: { ...chartOptions("Ronde").plugins.tooltip, callbacks: { label(context) {
        const row = lifetimeRows.find((item) => item.protocol === context.dataset.label);
        const field = fields[context.dataIndex];
        return row?.[field] === null ? `${context.dataset.label}: > ${formatInteger(horizon)} (belum mati)` : `${context.dataset.label}: ${formatInteger(context.parsed.y)} ronde`;
      } } } },
      scales: { ...chartOptions("Ronde").scales, y: { ...chartOptions("Ronde").scales.y, suggestedMax: Math.max(10, horizon || 0, ...lifetimeRows.flatMap((row) => [finiteNumber(row.fnd) || 0, finiteNumber(row.hnd) || 0, finiteNumber(row.lnd) || 0])) * 1.12 } },
    },
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
        return { label: protocol, data: rounds.map((round) => values.has(round) ? values.get(round) : null), borderColor: protocolColors[protocol], backgroundColor: protocolColors[protocol], borderWidth: 2.5, ...protocolStyles[protocol], pointRadius: (context) => context.dataIndex % 150 === 0 ? 3 : 0, pointHoverRadius: 5, pointHitRadius: 8, stepped: true, spanGaps: false };
      }),
    },
    options: chartOptions("Node hidup"),
  });
}

function censorCount(rows, protocol, metric = "LND") {
  return (rows || []).filter((row) => row[`${protocol}_${metric}`] === null).length;
}

function formatValidationMean(value, row, protocol, validationRows) {
  const formatted = row.metric === "PDR_pct" ? formatPercent(value) : formatDecimal(value);
  const censored = row.metric === "lifetime_index"
    ? ["FND", "HND", "LND"].some((metric) => censorCount(validationRows, protocol, metric) > 0)
    : censorCount(validationRows, protocol, row.metric) > 0;
  return `${formatted}${censored ? "*" : ""}`;
}

function renderValidation(rows) {
  const data = rows || [];
  const validationRows = state.dashboard?.validation_rows || [];
  const metrics = data.filter((row) => ["FND", "HND", "LND", "PDR_pct", "lifetime_index"].includes(row.metric));
  const empty = data.length === 0;
  $("#validationEmpty").classList.toggle("hidden", empty);
  $("#validationSeedCount").textContent = data[0]?.seed_count ?? validationRows.length ?? "—";
  $("#fuzzyCensoredCount").textContent = numberFormat.format(censorCount(validationRows, "FUZZY"));
  $("#gwoCensoredCount").textContent = numberFormat.format(censorCount(validationRows, "GWO"));
  const metricLabels = {
    FND: '<abbr title="Ronde saat node pertama mati">FND</abbr>',
    HND: '<abbr title="Ronde saat setidaknya separuh node mati">HND</abbr>',
    LND: '<abbr title="Ronde saat node terakhir mati">LND</abbr>',
    PDR_pct: '<abbr title="Rasio paket data yang berhasil diterima">PDR</abbr>',
    lifetime_index: '<abbr title="Rata-rata FND, HND, dan LND dibagi tiga kali horizon">Indeks umur</abbr>',
  };
  $("#validationTable").innerHTML = makeTable([
    { key: "metric", label: "Metrik", markup: "Metrik", render: (value) => metricLabels[value] || escapeHtml(value) },
    { key: "FUZZY_mean", label: "FUZZY", render: (value, row) => formatValidationMean(value, row, "FUZZY", validationRows) },
    { key: "GWO_mean", label: "GWO", render: (value, row) => formatValidationMean(value, row, "GWO", validationRows) },
    { key: "mean_delta_GWO_minus_FUZZY", label: "Δ GWO", markup: '<abbr title="Selisih rata-rata GWO dikurangi FUZZY">Δ GWO</abbr>', render: (value, row) => {
      const number = finiteNumber(value);
      if (number === null) return "—";
      const suffix = row.metric === "PDR_pct" ? " pp" : "";
      return `${number > 0 ? "+" : ""}${formatDecimal(number)}${suffix}`;
    } },
    { key: "GWO_wins", label: "Menang GWO", markup: '<abbr title="Jumlah seed yang nilai metriknya lebih baik menurut aturan pada ringkasan validasi">Menang GWO</abbr>', render: formatInteger },
    { key: "FUZZY_wins", label: "Menang FUZZY", markup: '<abbr title="Jumlah seed yang nilai metriknya lebih baik menurut aturan pada ringkasan validasi">Menang FUZZY</abbr>', render: formatInteger },
    { key: "ties", label: "Seri", render: formatInteger },
  ], metrics);
  renderValidationConclusion(metrics);
  renderValidationChart(data);
  const selectedMetric = $("#validationMetricSelect").value;
  renderValidationSeedsChart(validationRows, selectedMetric);
  renderValidationSeedTable(validationRows, selectedMetric);
}

function renderValidationConclusion(rows) {
  const byMetric = Object.fromEntries(rows.map((row) => [row.metric, row]));
  const total = finiteNumber(rows[0]?.seed_count) || state.dashboard?.validation_rows?.length || 0;
  const winners = { GWO: [], FUZZY: [], seimbang: [] };
  for (const [metric, name] of [["FND", "FND"], ["HND", "HND"], ["LND", "LND"], ["PDR_pct", "PDR"]]) {
    const row = byMetric[metric];
    if (!row || !total) continue;
    const gwo = finiteNumber(row.GWO_wins) || 0;
    const fuzzy = finiteNumber(row.FUZZY_wins) || 0;
    const ties = finiteNumber(row.ties) || 0;
    const winner = gwo > fuzzy ? "GWO" : fuzzy > gwo ? "FUZZY" : "seimbang";
    const count = Math.max(gwo, fuzzy);
    winners[winner].push(`${name} (${numberFormat.format(count)}/${numberFormat.format(total)} seed${ties ? `, ${numberFormat.format(ties)} seri` : ""})`);
  }
  const parts = ["GWO", "FUZZY", "seimbang"].filter((winner) => winners[winner].length).map((winner) => {
    const label = winner === "seimbang" ? "hasil seimbang pada" : `${winner} lebih unggul pada`;
    return `${label} ${winners[winner].join(" dan ")}`;
  });
  $("#validationConclusion").textContent = parts.length
    ? `${parts.join(", sedangkan ")}.`
    : "Kesimpulan akan tampil setelah data validasi tersedia.";
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
        { label: "FUZZY", data: data.map((row) => row.FUZZY_mean), backgroundColor: protocolColors.FUZZY, borderRadius: 4, maxBarThickness: 28, ...protocolStyles.FUZZY },
        { label: "GWO", data: data.map((row) => row.GWO_mean), backgroundColor: protocolColors.GWO, borderRadius: 4, maxBarThickness: 28, ...protocolStyles.GWO },
      ],
    },
    options,
  });
}

function renderValidationSeedsChart(rows, metric) {
  const horizon = finiteNumber(state.dashboard?.validation_horizon);
  const fields = { FUZZY: `FUZZY_${metric}`, GWO: `GWO_${metric}` };
  const seedRows = [...rows].filter((row) => finiteNumber(row.seed) !== null).sort((a, b) => a.seed - b.seed);
  const hasRows = seedRows.some((row) => Object.values(fields).some((field) => finiteNumber(row[field]) !== null || (metric !== "PDR_pct" && horizon !== null)));
  toggleChartEmpty("validationSeedsChart", "validationSeedsEmpty", !hasRows);
  if (!hasRows) return;
  const datasets = Object.entries(fields).map(([protocol, field]) => ({
    label: protocol,
    data: seedRows.map((row, index) => {
      const value = finiteNumber(row[field]);
      if (value === null && (metric === "PDR_pct" || horizon === null)) return null;
      return {
        x: index + (protocol === "FUZZY" ? -0.22 : 0.22),
        y: value ?? horizon,
        seed: row.seed,
        censored: value === null,
      };
    }).filter(Boolean),
    borderColor: protocolColors[protocol],
    backgroundColor: protocolColors[protocol],
    pointStyle: protocolStyles[protocol].pointStyle,
    pointRadius: (context) => context.raw?.censored ? 7 : 5,
    pointHoverRadius: 8,
    showLine: false,
  }));
  const flatValues = datasets.flatMap((dataset) => dataset.data.map((point) => point.y));
  const pdr = metric === "PDR_pct";
  const options = chartOptions(pdr ? "PDR (%)" : "Ronde");
  options.interaction = { mode: "nearest", intersect: true };
  options.plugins.tooltip.callbacks = {
    title(items) { return `Seed ${formatInteger(items[0]?.raw?.seed)}`; },
    label(context) {
      const point = context.raw;
      const value = point.censored ? `> ${formatInteger(horizon)} (belum tercapai)` : pdr ? formatPercent(point.y) : `${formatDecimal(point.y)} ronde`;
      return `${context.dataset.label}: ${value}`;
    },
  };
  options.scales.x = {
    type: "linear", min: -0.5, max: seedRows.length - 0.5,
    title: { display: true, text: "Seed uji", color: axisColor, font: { size: 13 } },
    grid: { display: false },
    ticks: { color: axisColor, stepSize: 1, maxTicksLimit: seedRows.length, font: { size: 13 }, callback(value) { return seedRows[Math.round(value)]?.seed ?? ""; } },
    border: { display: false },
  };
  const yMin = Math.min(...flatValues);
  const yMax = Math.max(...flatValues);
  options.scales.y = {
    ...options.scales.y,
    beginAtZero: false,
    min: pdr ? Math.floor(yMin * 10) / 10 - 0.1 : Math.max(0, Math.floor(yMin / 100) * 100 - 50),
    max: pdr ? Math.ceil(yMax * 10) / 10 + 0.1 : Math.ceil(yMax / 100) * 100 + 50,
  };
  replaceChart("validationSeeds", "validationSeedsChart", { type: "scatter", data: { datasets }, options });
}

function renderValidationSeedTable(rows, metric) {
  const horizon = finiteNumber(state.dashboard?.validation_horizon);
  const label = metric === "PDR_pct" ? "PDR" : metric;
  const formatSeedValue = (value) => {
    const number = finiteNumber(value);
    if (number !== null) return metric === "PDR_pct" ? formatPercent(number) : formatInteger(number);
    return metric === "PDR_pct" ? "—" : `> ${formatInteger(horizon)} (belum tercapai)`;
  };
  $("#validationSeedTableTitle").textContent = `Nilai seed uji · ${label}`;
  $("#validationSeedDataTable").innerHTML = makeTable([
    { key: "seed", label: "Seed uji", markup: '<abbr title="Seed terpisah yang dipakai untuk menguji model">Seed uji</abbr>' },
    { key: `FUZZY_${metric}`, label: `FUZZY · ${label}`, render: formatSeedValue },
    { key: `GWO_${metric}`, label: `GWO · ${label}`, render: formatSeedValue },
  ], [...rows].sort((a, b) => a.seed - b.seed));
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

function renderMembershipCharts(membership, baseline, ranges) {
  const grid = $("#membershipGrid");
  if (!membership || !baseline) {
    $("#membershipEmpty").classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  $("#membershipEmpty").classList.add("hidden");
  const definitions = [
    { key: "energy", title: "Energi sisa", unit: "rasio energi" },
    { key: "distance", title: "Jarak ke base station", unit: "meter" },
    { key: "neighbors", title: "Jumlah tetangga", unit: "node" },
    { key: "output", title: "Skor kelayakan", unit: "skor Mamdani" },
  ];
  grid.innerHTML = definitions.map((item) => {
    const isOutput = item.key === "output";
    const gwoPanel = isOutput
      ? `<section class="membership-series-panel is-gwo is-unoptimized" aria-label="GWO tidak diterapkan pada ${item.title.toLowerCase()}"><header class="membership-series-heading"><h4>GWO</h4><span>Tanpa optimasi</span></header><p class="membership-static-note">Skor kelayakan tetap memakai kurva MF awal.</p></section>`
      : `<section class="membership-series-panel is-gwo"><header class="membership-series-heading"><h4>GWO</h4><span>Hasil optimasi</span></header><div class="membership-chart"><canvas id="mf-${item.key}-gwo" role="img" aria-label="Fungsi keanggotaan ${item.title.toLowerCase()} setelah optimasi GWO"></canvas></div></section>`;
    return `<article class="membership-card"><h3>${item.title}</h3><p>${item.unit}</p><div class="membership-comparison-grid"><section class="membership-series-panel is-initial"><header class="membership-series-heading"><h4>MF awal</h4><span>Sebelum optimasi</span></header><div class="membership-chart"><canvas id="mf-${item.key}-initial" role="img" aria-label="Fungsi keanggotaan ${item.title.toLowerCase()} sebelum optimasi"></canvas></div></section>${gwoPanel}</div><details class="chart-data-details" data-membership-details="${item.key}"><summary>Lihat tabel nilai kurva</summary><div class="table-wrap" data-membership-table="${item.key}"></div></details></article>`;
  }).join("");
  definitions.forEach((definition) => {
    const axis = ranges?.[definition.key] || { min: 0, max: 1 };
    const min = finiteNumber(axis.min) ?? 0;
    const max = finiteNumber(axis.max) ?? 1;
    const values = Array.from({ length: 121 }, (_, index) => min + (max - min) * index / 120);
    const functions = membership[definition.key] || {};
    const initialFunctions = baseline[definition.key] || {};
    const models = [{ id: "initial", functions: initialFunctions, colors: membershipInitialColors, dash: [6, 4] }];
    if (definition.key !== "output") models.push({ id: "gwo", functions, colors: membershipOptimizedColors, dash: [] });
    const labels = [...new Set(models.flatMap((model) => Object.keys(model.functions)))];
    models.forEach((model) => {
      replaceChart(`mf-${definition.key}-${model.id}`, `mf-${definition.key}-${model.id}`, {
        type: "line",
        data: {
          labels: values.map((value) => Number(value.toFixed(2))),
          datasets: labels.filter((label) => model.functions[label]).map((label, index) => {
            const spec = model.functions[label];
            const color = model.colors[index % model.colors.length];
            return {
              label,
              data: values.map((value) => membershipDegree(spec.shape, spec.points, value)),
              borderColor: color, backgroundColor: color, borderWidth: model.id === "gwo" ? 3 : 2.5,
              borderDash: model.dash, pointRadius: 0, tension: 0,
            };
          }),
        },
        options: {
          ...chartOptions("Derajat keanggotaan"),
          plugins: { ...chartOptions("").plugins, legend: { ...chartOptions("").plugins.legend, labels: { ...chartOptions("").plugins.legend.labels, usePointStyle: false, boxWidth: 20, boxHeight: 2, padding: 9 } } },
          scales: {
            x: { ...chartOptions("").scales.x, ticks: { ...chartOptions("").scales.x.ticks, maxTicksLimit: 5 } },
            y: { ...chartOptions("").scales.y, min: 0, max: 1, ticks: { ...chartOptions("").scales.y.ticks, stepSize: 0.25 } },
          },
        },
      });
    });
  });
  grid.querySelectorAll("[data-membership-details]").forEach((details) => details.addEventListener("toggle", () => {
    if (!details.open || details.dataset.loaded) return;
    const key = details.dataset.membershipDetails;
    const definition = definitions.find((item) => item.key === key);
    const axis = ranges?.[key] || { min: 0, max: 1 };
    const min = finiteNumber(axis.min) ?? 0;
    const max = finiteNumber(axis.max) ?? 1;
    const values = [...new Set([
      ...Array.from({ length: 21 }, (_, index) => min + (max - min) * index / 20),
      ...[membership[key], baseline[key]].flatMap((group) => Object.values(group || {}).flatMap((spec) => spec.points)),
    ])].sort((a, b) => a - b);
    const modelList = key === "output"
      ? [{ name: "MF awal (tetap)", functions: baseline[key] || {} }]
      : [{ name: "MF awal", functions: baseline[key] || {} }, { name: "GWO", functions: membership[key] || {} }];
    const labels = [...new Set(modelList.flatMap((model) => Object.keys(model.functions)))];
    const columns = labels.flatMap((label) => modelList.filter((model) => model.functions[label]).map((model) => {
      const spec = model.functions[label];
      return {
        key: `${model.name}-${label}`,
        label: `${model.name} · ${label}`,
        render: (_, row) => formatDecimal(membershipDegree(spec.shape, spec.points, row.x)),
      };
    }));
    const tableRows = values.map((x) => ({ x }));
    $( `[data-membership-table="${key}"]`).innerHTML = makeTable([
      { key: "x", label: definition.unit, render: formatDecimal },
      ...columns,
    ], tableRows);
    details.dataset.loaded = "true";
  }));
  window.dashboardMotion?.refresh();
}

function loadGwoProcess() {
  if (state.gwoProcess) {
    renderGwoProcess();
    return;
  }
  if (state.gwoProcessLoading) return;
  state.gwoProcessLoading = true;
  $("#gwoProcessStatus").classList.remove("hidden");
  $("#gwoProcessStatus").textContent = "Memuat riwayat GWO hasil reproduksi…";
  fetch("/gwo-process-data.json", { headers: { Accept: "application/json" } })
    .then((response) => readApiResponse(response, "Riwayat GWO tidak dapat dimuat."))
    .then((data) => {
      state.gwoProcess = data;
      renderGwoProcess();
    })
    .catch((error) => {
      $("#gwoProcessStatus").classList.remove("hidden");
      $("#gwoProcessStatus").textContent = requestErrorMessage(error, "Riwayat GWO tidak dapat dimuat.");
    })
    .finally(() => { state.gwoProcessLoading = false; });
}

function renderGwoProcess() {
  const data = state.gwoProcess;
  if (!data) return;
  const config = data.configuration;
  const report = data.comparison;
  const reproducedDatasetIsSelected = state.dashboard?.dataset?.id === data.dataset_id;
  const status = $("#gwoProcessStatus");
  status.classList.remove("hidden");
  status.classList.toggle("notice-success", data.matches_saved_membership && reproducedDatasetIsSelected);
  status.classList.toggle("notice-warning", !data.matches_saved_membership || !reproducedDatasetIsSelected);
  status.textContent = data.matches_saved_membership && reproducedDatasetIsSelected
    ? `Riwayat ini cocok dengan MF tersimpan pada ${data.dataset_label}; konfigurasi GWO proyek dijalankan ulang secara deterministik.`
    : data.matches_saved_membership
      ? `Riwayat kalibrasi ini cocok dengan MF tersimpan pada ${data.dataset_label}. Dataset aktif ${state.dashboard?.dataset?.label || "belum dimuat"}; tabel MF di bawah mengikuti pilihan dataset, sedangkan grafik dan fitness tetap dari eksperimen utama.`
      : `Riwayat ini adalah reproduksi dari konfigurasi proyek. MF akhirnya berbeda dari file tersimpan pada ${data.dataset_label}; angka tidak diklaim sebagai log historis file tersebut.`;

  const metricColumns = [
    { key: "name", label: "Tahap" },
    { key: "score", label: "Fitness", render: formatDecimal },
    { key: "fnd", label: "FND", render: formatDecimal },
    { key: "r10", label: "R10", render: formatDecimal },
    { key: "hnd", label: "HND", render: formatDecimal },
    { key: "r90", label: "R90", render: formatDecimal },
    { key: "lnd", label: "LND", render: formatDecimal },
    { key: "peak_residual", label: "Energi puncak", render: formatDecimal },
    { key: "mean_residual", label: "Energi rata-rata", render: formatDecimal },
    { key: "pdr_pct", label: "PDR (%)", render: formatDecimal },
  ];
  const comparisonRows = [
    { name: "MF awal", ...report.manual },
    { name: "Warm start", ...report.warm_start },
    { name: "Solusi terbaik", ...report.best },
  ];
  const weightLabels = {
    fnd: "FND", r10: "R10", hnd: "HND", r90: "R90", lnd: "LND",
    peak_residual: "Energi puncak tersisa", mean_residual: "Rata-rata energi tersisa", pdr: "PDR",
  };
  const weights = Object.entries(data.weights).map(([key, value]) => ({ metric: weightLabels[key] || key, weight: value }));

  $("#gwoProcessContent").innerHTML = `
    <article class="panel process-overview">
      <div class="panel-heading"><div><h2 class="panel-title">GWO menyetel kurva, FIS tetap memilih node</h2><p class="panel-caption">Grey Wolf Optimizer mencari titik transisi MF input yang memberi skor fitness terbaik. Setiap kandidat dinilai dengan menjalankan protokol GWO pada kumpulan topologi tetap.</p></div><span class="panel-unit">${escapeHtml(config.fitness_mode)} · maksimum</span></div>
      <div class="process-stat-grid">
        <div><span>Serigala</span><strong>${formatInteger(config.wolves)}</strong></div><div><span>Generasi pembaruan</span><strong>${formatInteger(config.iterations)}</strong></div><div><span>Dimensi pencarian</span><strong>${formatInteger(config.dimension)}</strong></div><div><span>Evaluasi populasi</span><strong>${formatInteger(config.evaluations)}</strong></div>
      </div>
      <p class="process-note">Konfigurasi reproduksi: ${formatInteger(config.fitness_rounds)} ronde · ${formatInteger(config.fitness_seeds.length)} seed fitness (${config.fitness_seeds.join(", ")}) · seed optimizer ${formatInteger(config.optimizer_seed)}. Variabel area ${formatDecimal(config.simulation.width_m)} × ${formatDecimal(config.simulation.height_m)} m; ${formatInteger(config.simulation.nodes)} node.</p>
      <ol class="process-flow" aria-label="Tahapan kalibrasi GWO"><li><span>Representasi</span><strong>13 koordinat MF</strong><p>Tiga untuk energi, lima untuk jarak, dan lima untuk tetangga.</p></li><li><span>Populasi awal</span><strong>${formatInteger(config.wolves)} wolf</strong><p>Vektor MF ahli dipakai sebagai warm start pada populasi.</p></li><li><span>Evaluasi</span><strong>Fitness pada ${formatInteger(config.fitness_seeds.length)} seed tetap</strong><p>Setiap kandidat menjalankan protokol GWO hingga ${formatInteger(config.fitness_rounds)} ronde.</p></li><li><span>Pembaruan</span><strong>Alpha · beta · delta</strong><p>Ketiga pemimpin membentuk posisi wolf pada generasi berikutnya.</p></li><li><span>Hasil</span><strong>Simpan solusi terbaik</strong><p>Solusi global terbaik diubah kembali menjadi MF untuk protokol GWO.</p></li></ol>
    </article>

    <article class="panel">
      <div class="panel-heading"><div><h2 class="panel-title">Konvergensi fitness</h2><p class="panel-caption">Garis terbaik menunjukkan solusi global terbaik sampai generasi itu; garis rata-rata merangkum populasi generasi tersebut. Nilai lebih tinggi lebih baik.</p></div><span class="panel-unit">skor 0–1</span></div>
      <div class="chart-frame chart-frame-tall"><canvas id="gwoFitnessChart" role="img" aria-label="Grafik fitness terbaik dan rata-rata populasi per generasi"></canvas></div>
      <details class="chart-data-details"><summary>Lihat nilai fitness per generasi</summary><div id="gwoFitnessTable" class="table-wrap"></div></details>
    </article>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
      <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Pemimpin populasi</h2><p class="panel-caption">Alpha, beta, dan delta dipilih ulang menurut fitness di setiap generasi.</p></div><label class="process-select-label" for="gwoIterationSelect">Generasi<select id="gwoIterationSelect" class="dataset-select"><option value="">Pilih generasi</option></select></label></div><div id="gwoLeaderTable" class="table-wrap"></div></article>
      <aside class="notice process-explainer"><h2>Pemimpin dan kandidat lain</h2><p><strong>Alpha</strong> adalah kandidat terbaik, <strong>beta</strong> kedua, dan <strong>delta</strong> ketiga. Semua wolf memperbarui posisi dengan menggabungkan tarikan ketiga pemimpin.</p><p>Implementasi proyek tidak menetapkan peran <strong>gamma</strong>. Kandidat rank 4 pada tabel tetap wolf biasa, bukan pemimpin keempat.</p><p>Koordinat yang diperbarui adalah 13 titik MF input: 3 energi, 5 jarak, dan 5 jumlah tetangga. MF output dan 27 aturan Mamdani tetap.</p><details class="chart-data-details"><summary>Lihat rumus perpindahan</summary><div class="gwo-equations"><code>Dα = |C₁ × Xα − X|</code><code>Yα = Xα − A₁ × Dα</code><code>X baru = clip((Yα + Yβ + Yδ) / 3, 0, 1)</code><code>A = a(2r₁ − 1) · C = 2r₂</code><code>a = 2 − 2t / (T − 1)</code></div><p class="table-footnote">t adalah indeks generasi dan T jumlah pembaruan. Nilai a turun dari 2 ke 0; tiap wolf bergerak menuju gabungan tiga pemimpin.</p></details></aside>
    </div>

    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Posisi Alpha di ruang pencarian</h2><p class="panel-caption">Tiga belas koordinat Alpha pada generasi terpilih. GWO mencari setiap titik dalam skala 0–1, lalu decoder mengubahnya menjadi batas kurva MF.</p></div><span id="gwoAlphaSummary" class="panel-unit"></span></div><div id="gwoAlphaCoordinates" class="gwo-coordinate-grid" aria-live="polite"></div><p class="table-footnote">x1–x3 mengatur energi · x4–x8 mengatur jarak · x9–x13 mengatur jumlah tetangga. Batang menunjukkan posisi pencarian ternormalisasi, bukan nilai energi atau meter.</p></article>

    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Apa yang dinilai oleh fitness?</h2><p class="panel-caption">Fitness menggabungkan metrik jaringan yang dinormalisasi. Pada mode lifetime, setiap komponen aktif berbobot 0,30 lalu total dibagi jumlah bobot.</p></div><span class="panel-unit">fitness ${formatDecimal(report.manual.score)} → ${formatDecimal(report.best.score)}</span></div><div class="table-wrap">${makeTable(metricColumns, comparisonRows.map((row) => ({ ...row, score: row.score })))}</div><div class="gwo-weight-table">${makeTable([{ key: "metric", label: "Komponen" }, { key: "weight", label: "Bobot", render: formatDecimal }], weights)}</div><p class="table-footnote">FND = node pertama mati; R10/R90 = 10%/90% node mati; HND = separuh mati; LND = node terakhir mati. Milestone yang belum tercapai dihitung pada batas horizon ${formatInteger(config.fitness_rounds)} ronde.</p></article>

    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">MF GWO pada dataset terpilih</h2><p class="panel-caption">Titik kurva input pada file dashboard yang sedang dipilih, bukan vektor normalisasi tiap wolf.</p></div><span class="panel-unit">${escapeHtml(state.dashboard?.dataset?.label || "Memuat dataset")}</span></div><div id="gwoStoredMembershipTable" class="table-wrap"></div></article>
  `;

  const historyRows = data.history.map((row) => ({ ...row }));
  $("#gwoFitnessTable").innerHTML = makeTable([
    { key: "iteration", label: "Generasi", render: formatInteger },
    { key: "best_fitness", label: "Fitness terbaik", render: formatDecimal },
    { key: "mean_fitness", label: "Rata-rata populasi", render: formatDecimal },
  ], historyRows);
  replaceChart("gwoFitness", "gwoFitnessChart", {
    type: "line",
    data: {
      labels: data.history.map((row) => `Gen ${row.iteration}`),
      datasets: [
        { label: "Terbaik sejauh ini", data: data.history.map((row) => row.best_fitness), borderColor: "#00765e", backgroundColor: "#00765e", borderWidth: 2.5, pointRadius: 3, tension: 0 },
        { label: "Rata-rata populasi", data: data.history.map((row) => row.mean_fitness), borderColor: "#3568a8", backgroundColor: "#3568a8", borderWidth: 2, borderDash: [5, 4], pointRadius: 2, tension: 0 },
      ],
    },
    options: chartOptions("Fitness"),
  });
  const iterationSelect = $("#gwoIterationSelect");
  iterationSelect.innerHTML = data.history.map((row) => `<option value="${row.iteration}">Generasi ${row.iteration}${row.iteration === 0 ? " · awal" : ""}</option>`).join("");
  iterationSelect.addEventListener("change", (event) => renderGwoLeaders(Number(event.target.value)));
  renderGwoLeaders(0);
  renderGwoStoredMembership();
}

function renderGwoLeaders(iteration) {
  const population = (state.gwoProcess?.population || [])
    .filter((row) => row.iteration === iteration)
    .sort((a, b) => a.rank - b.rank);
  const leaders = population
    .filter((row) => row.rank <= 4)
    .sort((a, b) => a.rank - b.rank)
    .map((row) => ({
      wolf: row.wolf,
      rank: row.rank,
      role: row.role,
      fitness: row.fitness,
      vector: row.position.map((value, index) => `x${index + 1}=${formatDecimal(value)}`).join(" · "),
    }));
  $("#gwoLeaderTable").innerHTML = makeTable([
    { key: "role", label: "Peran", render: (value, row) => `${escapeHtml(formatRoleLabel(value, row.rank))} · Wolf ${formatInteger(row.wolf)}` },
    { key: "fitness", label: "Fitness", render: formatDecimal },
    { key: "vector", label: "Vektor 13 koordinat", render: (value) => `<details><summary>Lihat posisi</summary><p class="process-vector">${escapeHtml(value)}</p></details>` },
  ], leaders);

  const alpha = population.find((row) => row.role === "alpha") || population[0];
  const coordinates = $("#gwoAlphaCoordinates");
  const summary = $("#gwoAlphaSummary");
  if (!coordinates || !summary) return;
  if (!alpha?.position?.length) {
    summary.textContent = "Alpha belum tersedia";
    coordinates.innerHTML = '<p class="table-footnote">Posisi Alpha tidak tersedia untuk generasi ini.</p>';
    return;
  }
  summary.textContent = `Generasi ${formatInteger(iteration)} · Wolf ${formatInteger(alpha.wolf)} · fitness ${formatDecimal(alpha.fitness)}`;
  const groups = [
    { label: "Energi", range: [0, 3], tone: "energy" },
    { label: "Jarak", range: [3, 8], tone: "distance" },
    { label: "Jumlah tetangga", range: [8, 13], tone: "neighbors" },
  ];
  coordinates.innerHTML = groups.map((group) => {
    const items = alpha.position.slice(group.range[0], group.range[1]).map((value, offset) => {
      const index = group.range[0] + offset;
      const normalized = Math.max(0, Math.min(1, finiteNumber(value) ?? 0));
      const percent = normalized * 100;
      return `<div class="gwo-coordinate-item"><div><span>x${index + 1}</span><strong>${formatDecimal(normalized)}</strong></div><span class="gwo-coordinate-track" role="meter" aria-label="Koordinat x${index + 1}: ${formatDecimal(normalized)} dari 0 sampai 1" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${normalized}"><i style="width:${percent}%"></i></span></div>`;
    }).join("");
    return `<section class="gwo-coordinate-group gwo-coordinate-${group.tone}"><h3>${group.label}</h3><div class="gwo-coordinate-items">${items}</div></section>`;
  }).join("");
}

function formatRoleLabel(role, rank) {
  return ({ alpha: "Alpha · terbaik", beta: "Beta · kedua", delta: "Delta · ketiga" })[role] || `Kandidat rank ${rank}`;
}

function renderGwoStoredMembership() {
  const target = $("#gwoStoredMembershipTable");
  const membership = state.dashboard?.membership;
  if (!target) return;
  if (!membership || state.dashboard?.dataset?.id !== state.datasetId) {
    target.innerHTML = '<p class="table-footnote">Memuat fungsi keanggotaan untuk dataset terpilih…</p>';
    return;
  }
  const rows = Object.entries(membership).flatMap(([variable, functions]) => Object.entries(functions).map(([label, definition]) => ({
    variable: ({ energy: "Energi", distance: "Jarak", neighbors: "Jumlah tetangga", output: "Output" })[variable] || variable,
    label,
    shape: definition.shape === "trap" ? "Trapesium" : "Segitiga",
    points: definition.points.map((value) => formatDecimal(value)).join(", "),
  })));
  target.innerHTML = makeTable([
    { key: "variable", label: "Variabel" }, { key: "label", label: "Himpunan" },
    { key: "shape", label: "Bentuk MF" }, { key: "points", label: "Titik kurva" },
  ], rows);
}

function renderFisProcess() {
  const dashboard = state.dashboard;
  const content = $("#fisProcessContent");
  if (!dashboard?.fis_process || !dashboard.membership || !dashboard.membership_baseline) {
    $("#fisProcessStatus").classList.remove("hidden");
    $("#fisProcessStatus").textContent = "Data FIS belum dimuat. Pilih dataset yang tersedia atau muat ulang halaman.";
    content.innerHTML = "";
    return;
  }
  $("#fisProcessStatus").classList.add("hidden");
  const fis = dashboard.fis_process;
  content.innerHTML = `
    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Dari kondisi node ke skor</h2><p class="panel-caption">FIS Mamdani mengubah tiga masukan node menjadi skor kelayakan. Protokol FUZZY menggunakan MF awal; protokol GWO menggunakan MF input yang dikalibrasi. Basis aturan dan MF output tetap sama.</p></div><span class="panel-unit">${formatInteger(fis.rule_count)} aturan · ${formatInteger(fis.output_points)} titik output</span></div><ol class="process-flow"><li><span>Masukan</span><strong>Energi · jarak · tetangga</strong><p>Fitur node aktif dihitung pada tiap ronde.</p></li><li><span>Fuzzifikasi</span><strong>Derajat keanggotaan 0–1</strong><p>Setiap masukan dapat masuk ke beberapa himpunan linguistik.</p></li><li><span>Inferensi Mamdani</span><strong>MIN untuk AND, MAX untuk agregasi</strong><p>Kekuatan aturan adalah nilai minimum tiga derajat input.</p></li><li><span>Defuzzifikasi</span><strong>Titik berat (centroid)</strong><p>Output fuzzy digabung lalu diringkas menjadi satu skor tegas.</p></li><li><span>Pemilihan CH</span><strong>Urutkan skor node</strong><p>Node dengan skor tertinggi dipilih sesuai jumlah cluster head.</p></li></ol></article>

    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Coba satu kandidat node</h2><p class="panel-caption">Kalkulator mengikuti MF dan 27 aturan yang digunakan kode untuk dataset terpilih. Skor ini untuk satu kandidat, belum merupakan pemilihan CH dari seluruh node.</p></div></div><div class="fis-workbench"><form id="fisWorkbenchForm" class="fis-inputs"><label class="field-label" for="fisModelSelect">Kurva input<select id="fisModelSelect" class="field-input"><option value="gwo">MF GWO · dataset aktif</option><option value="baseline">MF awal</option></select></label><label class="field-label" for="fisEnergyValue">Energi tersisa<span class="field-help">fraksi dari energi awal (0–1)</span><input id="fisEnergyValue" class="field-input" type="number" min="0" max="1" step="0.01" value="0.8" required></label><label class="field-label" for="fisDistanceValue">Jarak ke base station<span class="field-help">meter</span><input id="fisDistanceValue" class="field-input" type="number" min="0" max="${escapeHtml(dashboard.membership_ranges?.distance?.max || 150)}" step="0.1" value="30" required></label><label class="field-label" for="fisNeighborsValue">Jumlah tetangga<span class="field-help">node di sekitar kandidat</span><input id="fisNeighborsValue" class="field-input" type="number" min="0" max="${Math.max(0, (finiteNumber(fis.nodes) || 30) - 1)}" step="1" value="5" required></label><button class="button button-primary" type="submit">Hitung skor FIS</button></form><div class="fis-result"><div class="fis-score-line"><span>Skor kelayakan kandidat</span><strong id="fisCandidateScore">—</strong></div><p id="fisResultCaption" class="panel-caption">Ubah kondisi lalu hitung untuk melihat jalur inferensi.</p><div class="fis-visual-grid"><section class="fis-visual"><h3>Derajat keanggotaan input</h3><p>0 berarti tidak cocok, 1 berarti cocok penuh.</p><div class="chart-frame chart-frame-fis"><canvas id="fisDegreesChart" role="img" aria-label="Diagram batang derajat keanggotaan energi, jarak, dan jumlah tetangga"></canvas></div><div id="fisDegreesTable" class="table-wrap"></div></section><section class="fis-visual"><h3>Kurva output setelah aturan</h3><p>Garis berwarna adalah konsekuen yang dipotong; garis tebal adalah gabungannya.</p><div class="chart-frame chart-frame-fis"><canvas id="fisOutputChart" role="img" aria-label="Kurva output Mamdani setelah agregasi aturan dan posisi centroid"></canvas></div><div id="fisOutputTable" class="table-wrap"></div></section></div><h3 class="fis-active-heading">Aturan yang aktif</h3><div id="fisActiveRules" class="table-wrap"></div></div></div></article>

    <article class="panel"><div class="panel-heading"><div><h2 class="panel-title">Basis aturan Mamdani</h2><p class="panel-caption">Semua kombinasi energi × jarak × jumlah tetangga menghasilkan ${formatInteger(fis.rule_count)} aturan. Konsekuen di bawah diambil langsung dari FuzzyRuleBase pada server.</p></div></div><div id="fisRuleTable" class="table-wrap"></div></article>
  `;
  const labels = { Rendah: "Rendah", Sedang: "Sedang", Tinggi: "Tinggi", Dekat: "Dekat", Jauh: "Jauh", Sedikit: "Sedikit", Banyak: "Banyak" };
  $("#fisRuleTable").innerHTML = makeTable([
    { key: "index", label: "Aturan", render: (value) => `R${formatInteger(value)}` },
    { key: "energy", label: "Energi" }, { key: "distance", label: "Jarak" },
    { key: "neighbors", label: "Tetangga" }, { key: "output", label: "Skor output" },
  ], fis.rules.map((rule, index) => ({ index: index + 1, ...rule, energy: labels[rule.energy] || rule.energy, distance: labels[rule.distance] || rule.distance, neighbors: labels[rule.neighbors] || rule.neighbors, output: labels[rule.output] || rule.output })));
  $("#fisWorkbenchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    calculateFisCandidate();
  });
  $("#fisModelSelect").addEventListener("change", calculateFisCandidate);
  calculateFisCandidate();
}

function calculateFisCandidate() {
  const dashboard = state.dashboard;
  const fis = dashboard?.fis_process;
  if (!fis || !$("#fisEnergyValue")) return;
  const modelName = $("#fisModelSelect").value;
  const membership = modelName === "baseline" ? dashboard.membership_baseline : dashboard.membership;
  const inputs = {
    energy: Number($("#fisEnergyValue").value),
    distance: Number($("#fisDistanceValue").value),
    neighbors: Number($("#fisNeighborsValue").value),
  };
  const labels = {
    energy: ["Rendah", "Sedang", "Tinggi"],
    distance: ["Dekat", "Sedang", "Jauh"],
    neighbors: ["Sedikit", "Sedang", "Banyak"],
  };
  const degrees = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [
    key,
    Object.fromEntries(labels[key].map((label) => [label, membershipDegree(membership[key][label].shape, membership[key][label].points, value)])),
  ]));
  const rules = fis.rules.map((rule, index) => ({
    index: index + 1,
    ...rule,
    strength: Math.min(degrees.energy[rule.energy], degrees.distance[rule.distance], degrees.neighbors[rule.neighbors]),
  }));
  const activations = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  rules.forEach((rule) => { activations[rule.output] = Math.max(activations[rule.output], rule.strength); });
  const outputMembership = membership.output;
  const outputX = Array.from({ length: fis.output_points }, (_, index) => index / (fis.output_points - 1));
  const aggregate = outputX.map((x) => Math.max(...Object.entries(activations).map(([label, activation]) => Math.min(
    activation,
    membershipDegree(outputMembership[label].shape, outputMembership[label].points, x),
  ))));
  let area = 0;
  let moment = 0;
  for (let index = 0; index < outputX.length - 1; index += 1) {
    const dx = outputX[index + 1] - outputX[index];
    area += ((aggregate[index] + aggregate[index + 1]) * dx) / 2;
    moment += ((aggregate[index] * outputX[index] + aggregate[index + 1] * outputX[index + 1]) * dx) / 2;
  }
  const score = area > 1e-15 ? moment / area : 0.5;
  $("#fisCandidateScore").textContent = formatDecimal(score);
  $("#fisResultCaption").textContent = `Model ${modelName === "baseline" ? "MF awal" : `GWO · ${dashboard.dataset.label}`} · MIN memberi kekuatan tiap aturan, lalu MAX menggabungkan kurva output.`;
  const variableLabels = { energy: "Energi", distance: "Jarak", neighbors: "Tetangga" };
  $("#fisDegreesTable").innerHTML = makeTable([
    { key: "variable", label: "Input" }, { key: "low", label: "Rendah / dekat / sedikit", render: formatDecimal },
    { key: "middle", label: "Sedang", render: formatDecimal }, { key: "high", label: "Tinggi / jauh / banyak", render: formatDecimal },
  ], Object.entries(degrees).map(([key, values]) => ({ variable: variableLabels[key], low: values[labels[key][0]], middle: values[labels[key][1]], high: values[labels[key][2]] })));
  renderFisVisuals(degrees, labels, outputMembership, outputX, aggregate, activations, score);
  const activeRules = rules.filter((rule) => rule.strength > 0).sort((a, b) => b.strength - a.strength || a.index - b.index);
  $("#fisActiveRules").innerHTML = makeTable([
    { key: "index", label: "Aturan", render: (value) => `R${formatInteger(value)}` },
    { key: "energy", label: "Energi" }, { key: "distance", label: "Jarak" },
    { key: "neighbors", label: "Tetangga" }, { key: "output", label: "Konsekuen" },
    { key: "strength", label: "Kekuatan MIN", render: formatDecimal },
  ], activeRules);
}

function renderFisVisuals(degrees, labels, outputMembership, outputX, aggregate, activations, score) {
  const inputRows = [
    { key: "energy", label: "Energi", names: labels.energy },
    { key: "distance", label: "Jarak", names: labels.distance },
    { key: "neighbors", label: "Tetangga", names: labels.neighbors },
  ];
  const degreeColors = ["#216e8a", "#b34d16", "#6c50a1"];
  const degreeNames = ["Rendah · dekat · sedikit", "Sedang", "Tinggi · jauh · banyak"];
  replaceChart("fisDegrees", "fisDegreesChart", {
    type: "bar",
    data: {
      labels: inputRows.map((row) => row.label),
      datasets: degreeNames.map((label, index) => ({
        label,
        data: inputRows.map((row) => degrees[row.key][row.names[index]]),
        backgroundColor: degreeColors[index],
        borderRadius: 3,
        maxBarThickness: 16,
      })),
    },
    options: {
      ...chartOptions("Derajat"),
      indexAxis: "y",
      scales: {
        x: { min: 0, max: 1, grid: { color: "#e5eae6" }, ticks: { color: "#53665f", stepSize: 0.25, font: { size: 12 } }, border: { display: false } },
        y: { grid: { display: false }, ticks: { color: "#40534e", font: { size: 13 } }, border: { display: false } },
      },
      plugins: { ...chartOptions("Derajat").plugins, legend: { ...chartOptions("Derajat").plugins.legend, position: "bottom" } },
    },
  });

  const outputColors = { Rendah: "#216e8a", Sedang: "#b34d16", Tinggi: "#6c50a1" };
  const outputCurves = Object.entries(activations).map(([label, activation]) => ({
    label: `Potongan ${label.toLowerCase()}`,
    data: outputX.map((x) => ({ x, y: Math.min(activation, membershipDegree(outputMembership[label].shape, outputMembership[label].points, x)) })),
    borderColor: outputColors[label],
    backgroundColor: outputColors[label],
    borderWidth: 1.5,
    borderDash: [4, 3],
    pointRadius: 0,
    tension: 0,
    fill: false,
  }));
  const maximumAggregate = Math.max(...aggregate, 0.01);
  replaceChart("fisOutput", "fisOutputChart", {
    type: "line",
    data: {
      datasets: [
        ...outputCurves,
        { label: "Agregasi MAX", data: outputX.map((x, index) => ({ x, y: aggregate[index] })), borderColor: "#176b55", backgroundColor: "rgba(23,107,85,.12)", borderWidth: 3, pointRadius: 0, tension: 0, fill: "origin", order: 1 },
        { label: `Centroid ${formatDecimal(score)}`, data: [{ x: score, y: 0 }, { x: score, y: maximumAggregate }], borderColor: "#1b2930", backgroundColor: "#1b2930", borderWidth: 2, borderDash: [3, 3], pointRadius: 0, tension: 0, fill: false, order: 0 },
      ],
    },
    options: {
      ...chartOptions("Derajat keanggotaan"),
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: { type: "linear", min: 0, max: 1, title: { display: true, text: "Skor keluaran", color: "#53665f", font: { size: 12 } }, grid: { display: false }, ticks: { color: "#53665f", maxTicksLimit: 6, font: { size: 12 }, callback: (value) => Number(value).toFixed(1) }, border: { display: false } },
        y: { min: 0, max: 1, title: { display: true, text: "Derajat", color: "#53665f", font: { size: 12 } }, grid: { color: "#e5eae6" }, ticks: { color: "#53665f", stepSize: 0.25, font: { size: 12 } }, border: { display: false } },
      },
    },
  });

  const sampleRows = Array.from({ length: 11 }, (_, index) => {
    const point = index * (outputX.length - 1) / 10;
    const lowerIndex = Math.floor(point);
    const upperIndex = Math.min(outputX.length - 1, Math.ceil(point));
    const fraction = point - lowerIndex;
    const aggregateValue = aggregate[lowerIndex] + (aggregate[upperIndex] - aggregate[lowerIndex]) * fraction;
    return {
      x: index / 10,
      rendah: Math.min(activations.Rendah, membershipDegree(outputMembership.Rendah.shape, outputMembership.Rendah.points, index / 10)),
      sedang: Math.min(activations.Sedang, membershipDegree(outputMembership.Sedang.shape, outputMembership.Sedang.points, index / 10)),
      tinggi: Math.min(activations.Tinggi, membershipDegree(outputMembership.Tinggi.shape, outputMembership.Tinggi.points, index / 10)),
      aggregate: aggregateValue,
    };
  });
  $("#fisOutputTable").innerHTML = `<details class="chart-data-details"><summary>Lihat 11 sampel kurva</summary>${makeTable([
    { key: "x", label: "Skor output" },
    { key: "rendah", label: "Rendah" }, { key: "sedang", label: "Sedang" },
    { key: "tinggi", label: "Tinggi" }, { key: "aggregate", label: "Agregasi MAX" },
  ], sampleRows)}</details>`;
}

function updateDatasetDescription(dataset) {
  $("#datasetDescription").textContent = dataset?.description || "Data eksperimen yang dipilih.";
}

function updateDownloadButtons() {
  const dashboardIsCurrent = state.dashboard?.dataset?.id === state.datasetId;
  $("#downloadPrimary").disabled = !dashboardIsCurrent || !state.dashboard?.summary?.length;
  $("#downloadValidation").disabled = !dashboardIsCurrent || !state.dashboard?.validation?.length;
  $("#downloadMembership").disabled = !dashboardIsCurrent || !Object.keys(state.dashboard?.membership || {}).length;
  $("#downloadSimulation").disabled = !state.simulation
    || state.simulation.config?.dataset_id !== state.datasetId
    || !state.simulation.history?.length;
}

function clearDashboardVisuals() {
  Object.values(state.charts).forEach((chart) => chart.destroy());
  state.charts = {};
  renderSummary([]);
  renderHistoryChart([]);
  renderValidation([]);
  renderMembershipCharts(null, null, null);
  $("#historyDataDetails").dataset.loaded = "false";
  $("#historyDataTable").innerHTML = "";
}

function clearSimulationResult() {
  state.simulation = null;
  state.charts.simulation?.destroy();
  delete state.charts.simulation;
  $("#simulationResults").classList.add("hidden");
  $("#simulationPlaceholder").classList.remove("hidden");
  $("#simulationMetrics").innerHTML = "";
  $("#simulationTable").innerHTML = "";
  $("#simulationDataDetails").dataset.loaded = "false";
  $("#simulationDataTable").innerHTML = "";
  $("#simulationStatus").textContent = "menunggu simulasi";
  updateDownloadButtons();
}

async function loadDashboard(datasetId = state.datasetId) {
  const requestId = ++state.dashboardRequestId;
  const selectedDataset = String(datasetId);
  if (selectedDataset !== state.datasetId) clearSimulationResult();
  state.datasetId = selectedDataset;
  state.dashboard = null;
  updateDownloadButtons();
  setError("");
  setLoading(true);
  updateDatasetDescription({ description: "Memuat data untuk dataset yang dipilih…" });
  clearDashboardVisuals();
  try {
    const response = await authenticatedFetch(`/api/dashboard?dataset=${encodeURIComponent(selectedDataset)}`, { headers: { Accept: "application/json" } });
    const data = await readApiResponse(response, "Data eksperimen tidak dapat dimuat.");
    if (requestId !== state.dashboardRequestId) return;
    if (data.dataset?.id !== selectedDataset) throw new Error("Server mengirim data untuk dataset yang berbeda. Silakan muat ulang.");
    state.dashboard = data;
    updateDatasetDescription(data.dataset);
    renderSummary(data.summary);
    renderHistoryChart(data.history);
    renderValidation(data.validation);
    renderMembershipCharts(data.membership, data.membership_baseline, data.membership_ranges);
    if (state.view === "fis") renderFisProcess();
    if (state.view === "gwo") {
      if (state.gwoProcess) renderGwoProcess();
      else renderGwoStoredMembership();
    }
    $("#historyDataDetails").dataset.loaded = "false";
    $("#historyDataTable").innerHTML = "";
    setConnectionStatus("Terhubung");
  } catch (error) {
    if (requestId === state.dashboardRequestId) {
      setConnectionStatus("Data tidak tersedia", false);
      setError(requestErrorMessage(error, "Data eksperimen tidak dapat dimuat."));
    }
  } finally {
    if (requestId === state.dashboardRequestId) {
      setLoading(false);
      updateDownloadButtons();
    }
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
  $("#simulationStatus").textContent = `${result.config.dataset_label || "Dataset"} · seed ${numberFormat.format(result.config.seed)}`;
  const bestLifetime = bestMetricRows(result.summary, "lnd", true);
  const bestPdr = bestMetricRows(result.summary, "pdr_total_pct");
  $("#simulationMetrics").innerHTML = [
    { label: "Umur terpanjang", value: bestLifetime.length ? `${escapeHtml(bestLifetime.map((row) => row.protocol).join(" + "))} · ${formatMilestone(bestLifetime[0].lnd, bestLifetime[0], result.config.rounds)}` : "—", hint: "LND tertinggi" },
    { label: "PDR tertinggi", value: bestPdr.length ? `${escapeHtml(bestPdr.map((row) => row.protocol).join(" + "))} · ${formatPercent(bestPdr[0].pdr_total_pct)}` : "—", hint: "paket diterima" },
    { label: "Seed topologi", value: formatInteger(result.config.seed), hint: "dapat diulang" },
  ].map((metric) => `<div class="sim-metric"><span>${metric.label}</span><strong>${metric.value}</strong><span class="mt-1">${metric.hint}</span></div>`).join("");
  $("#simulationTable").innerHTML = makeTable([
    { key: "protocol", label: "Protokol", render: protocolCell },
    { key: "fnd", label: "FND", markup: '<abbr title="Ronde saat node pertama mati">FND</abbr>', render: (value, row) => formatMilestone(value, row, result.config.rounds) },
    { key: "hnd", label: "HND", markup: '<abbr title="Ronde saat setidaknya separuh node mati">HND</abbr>', render: (value, row) => formatMilestone(value, row, result.config.rounds) },
    { key: "lnd", label: "LND", markup: '<abbr title="Ronde saat node terakhir mati">LND</abbr>', render: (value, row) => formatMilestone(value, row, result.config.rounds) },
    { key: "pdr_total_pct", label: "PDR", markup: '<abbr title="Rasio paket data yang berhasil diterima">PDR</abbr>', render: formatPercent },
  ], result.summary);
  $("#simulationDataDetails").dataset.loaded = "false";
  $("#simulationDataTable").innerHTML = "";
  renderSimulationChart(result.history);
  updateDownloadButtons();
  window.dashboardMotion?.refresh();
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
        return { label: protocol, data: rounds.map((round) => values.has(round) ? values.get(round) : null), borderColor: protocolColors[protocol], backgroundColor: protocolColors[protocol], borderWidth: 2.5, ...protocolStyles[protocol], pointRadius: (context) => context.dataIndex % 150 === 0 ? 3 : 0, pointHoverRadius: 5, pointHitRadius: 8, stepped: true, spanGaps: false };
      }),
    },
    options: chartOptions("Node hidup"),
  });
}

function renderSimulationTable(rows) {
  const data = [...(rows || [])].sort((a, b) => a.round_number - b.round_number || String(a.protocol).localeCompare(String(b.protocol)));
  $("#simulationDataTable").innerHTML = makeTable([
    { key: "round_number", label: "Ronde" },
    { key: "protocol", label: "Protokol", render: protocolCell },
    { key: "alive_nodes", label: "Node hidup", render: formatInteger },
  ], data);
  $("#simulationDataDetails").dataset.loaded = "true";
}

function renderHistoryTable(rows) {
  const data = [...(rows || [])].sort((a, b) => a.round_number - b.round_number || String(a.protocol).localeCompare(String(b.protocol)));
  $("#historyDataTable").innerHTML = makeTable([
    { key: "round_number", label: "Ronde" },
    { key: "protocol", label: "Protokol", render: protocolCell },
    { key: "alive_nodes", label: "Node hidup", render: formatInteger },
  ], data);
  $("#historyDataDetails").dataset.loaded = "true";
}

function toCsv(rows) {
  if (!rows?.length) return "";
  const quote = (value) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function datasetFileSlug() {
  return String(state.dashboard?.dataset?.id || state.datasetId || "dataset")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function downloadCsv(filename, headers, rows, emptyMessage) {
  if (!rows.length) {
    setError(emptyMessage);
    return;
  }
  const content = toCsv([headers, ...rows]);
  if (!content) {
    setError(emptyMessage);
    return;
  }
  setError("");
  downloadFile(filename, content, "text/csv;charset=utf-8");
}

function dashboardDataIsCurrent(view) {
  return state.view === view && state.dashboard?.dataset?.id === state.datasetId;
}

function downloadSummary() {
  if (!dashboardDataIsCurrent("hasil")) return;
  const horizon = state.dashboard.horizon;
  const dataset = state.dashboard.dataset.label;
  const exportMilestone = (value, row) => finiteNumber(value) ?? (value === null ? formatMilestone(value, row, horizon) : "");
  const rows = (state.dashboard.summary || []).map((row) => [
    dataset,
    row.protocol,
    exportMilestone(row.fnd, row),
    exportMilestone(row.hnd, row),
    exportMilestone(row.lnd, row),
    finiteNumber(row.pdr_total_pct),
    finiteNumber(row.last_round),
  ]);
  downloadCsv(`ringkasan_protokol_${datasetFileSlug()}.csv`, [
    "Dataset", "Protokol", "FND (ronde)", "HND (ronde)", "LND (ronde)", "PDR (%)", "Ronde akhir",
  ], rows, "Ringkasan untuk dataset ini belum tersedia.");
}

function downloadValidation() {
  if (!dashboardDataIsCurrent("validasi")) return;
  const validationRows = state.dashboard.validation_rows || [];
  const metricLabels = { FND: "FND", HND: "HND", LND: "LND", PDR_pct: "PDR", lifetime_index: "Indeks umur" };
  const rows = (state.dashboard.validation || [])
    .filter((row) => Object.prototype.hasOwnProperty.call(metricLabels, row.metric))
    .map((row) => {
      const censoredCount = (protocol) => row.metric === "lifetime_index"
        ? validationRows.filter((seed) => ["FND", "HND", "LND"].some((metric) => seed[`${protocol}_${metric}`] === null)).length
        : censorCount(validationRows, protocol, row.metric);
      return [
        state.dashboard.dataset.label,
        metricLabels[row.metric],
        finiteNumber(row.FUZZY_mean),
        finiteNumber(row.GWO_mean),
        finiteNumber(row.mean_delta_GWO_minus_FUZZY),
        finiteNumber(row.GWO_wins),
        finiteNumber(row.FUZZY_wins),
        finiteNumber(row.ties),
        finiteNumber(row.seed_count) ?? validationRows.length,
        censoredCount("FUZZY"),
        censoredCount("GWO"),
      ];
    });
  downloadCsv(`validasi_${datasetFileSlug()}.csv`, [
    "Dataset", "Metrik", "FUZZY rata-rata", "GWO rata-rata", "Δ GWO − FUZZY", "Menang GWO", "Menang FUZZY", "Seri", "Jumlah seed", "Seed tersensor FUZZY", "Seed tersensor GWO",
  ], rows, "Data validasi untuk dataset ini belum tersedia.");
}

function downloadMembership() {
  const value = state.dashboard?.membership;
  if (dashboardDataIsCurrent("membership") && value) {
    downloadFile(`parameter_mf_${datasetFileSlug()}.json`, JSON.stringify(value, null, 2), "application/json;charset=utf-8");
  }
}

function downloadSimulation() {
  const result = state.simulation;
  if (state.view !== "simulasi" || result?.config?.dataset_id !== state.datasetId) return;
  const config = result.config;
  const dataset = state.dashboard?.dataset?.label || config.dataset_label || config.dataset_id;
  const rows = (result.history || []).map((row) => [
    dataset,
    finiteNumber(config.seed),
    finiteNumber(config.nodes),
    finiteNumber(config.cluster_head_count),
    finiteNumber(config.rounds),
    finiteNumber(row.round_number),
    row.protocol,
    finiteNumber(row.alive_nodes),
  ]);
  downloadCsv(`hasil_simulasi_${datasetFileSlug()}_seed-${config.seed}.csv`, [
    "Dataset", "Seed topologi", "Jumlah node", "Jumlah cluster head", "Horizon ronde", "Ronde", "Protokol", "Node hidup",
  ], rows, "Metrik simulasi belum tersedia. Jalankan simulasi terlebih dahulu.");
}

function bindEvents() {
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view, { updateHash: true })));
  $("#datasetSelect").addEventListener("change", (event) => loadDashboard(event.target.value));
  $("#logoutButton").addEventListener("click", async () => {
    $("#logoutButton").disabled = true;
    await state.authClient.auth.signOut({ scope: "local" });
    window.location.replace("/login.html");
  });
  $("#downloadPrimary").addEventListener("click", downloadSummary);
  $("#downloadValidation").addEventListener("click", downloadValidation);
  $("#downloadMembership").addEventListener("click", downloadMembership);
  $("#downloadSimulation").addEventListener("click", downloadSimulation);
  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1);
    setView(viewText[view] ? view : "hasil");
  });
  $("#validationMetricSelect").addEventListener("change", (event) => {
    renderValidationSeedsChart(state.dashboard?.validation_rows || [], event.target.value);
    renderValidationSeedTable(state.dashboard?.validation_rows || [], event.target.value);
  });
  $("#historyDataDetails").addEventListener("toggle", (event) => {
    const details = event.currentTarget;
    if (details.open && details.dataset.loaded !== "true") renderHistoryTable(state.dashboard?.history || []);
  });
  $("#simulationDataDetails").addEventListener("toggle", (event) => {
    const details = event.currentTarget;
    if (details.open && details.dataset.loaded !== "true") renderSimulationTable(state.simulation?.history || []);
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
      dataset_id: state.datasetId,
    };
    if (!event.currentTarget.reportValidity()) return;
    setSimulationBusy(true);
    try {
      const response = await authenticatedFetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse(response, "Simulasi tidak dapat dijalankan.");
      if (payload.dataset_id !== state.datasetId || result.config?.dataset_id !== payload.dataset_id) return;
      renderSimulation(result);
      $("#simulationNotice").textContent = "Simulasi selesai. Anda dapat mengunduh metrik per ronde.";
      $("#simulationNotice").classList.remove("hidden");
      $("#simulationNotice").classList.add("notice-success");
      $("#simulationStatus").textContent = "selesai";
    } catch (error) {
      $("#simulationNotice").textContent = requestErrorMessage(error, "Simulasi gagal dijalankan.");
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
  try {
    state.authClient = await window.dashboardAuth.getClient();
  } catch (error) {
    redirectToLogin("setup");
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await state.authClient.auth.getSession();
    const session = sessionData?.session;
    if (sessionError || !session) {
      if (inviteType === "invite") {
        window.location.replace("/login.html?type=invite");
        return;
      }
      redirectToLogin();
      return;
    }
    if (inviteType === "invite") {
      window.location.replace("/login.html?type=invite");
      return;
    }

    const response = await authenticatedFetch("/api/datasets", { headers: { Accept: "application/json" } });
    const data = await readApiResponse(response, "Daftar dataset tidak dapat dimuat.");
    const identity = data.identity || {};
    const accountLabel = identity.name || session.user.email || "Akun aktif";
    const roleLabel = identity.role === "super_admin" ? " · Super admin" : "";
    $("#accountEmail").textContent = `${accountLabel}${roleLabel}`;
    $("#accountEmail").title = accountLabel;
    setConnectionStatus("Terhubung");
    state.datasets = data.datasets;
    state.datasetId = data.default || "results";
    $("#datasetSelect").innerHTML = state.datasets.map((dataset) => `<option value="${escapeHtml(dataset.id)}">${escapeHtml(dataset.label)}</option>`).join("");
    $("#datasetSelect").value = state.datasetId;
    bindEvents();
    updateDownloadButtons();
    const route = location.hash.slice(1);
    const initialView = viewText[route] ? route : "hasil";
    if (!viewText[route]) history.replaceState(null, "", `#${initialView}`);
    $("#dashboardApp").classList.remove("hidden");
    $("#authGate").classList.add("hidden");
    setView(initialView);
    await loadDashboard(state.datasetId);
    window.dashboardMotion?.initialize();
  } catch (error) {
    $("#authGateMessage").textContent = requestErrorMessage(error, "Akses dashboard belum dapat diperiksa.");
    $("#authGateLogin").classList.remove("hidden");
  }
}

start();

