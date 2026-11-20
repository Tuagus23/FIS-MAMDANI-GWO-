const state = { datasets: [], datasetId: "results", dashboard: null, simulation: null, charts: {}, view: "hasil", authClient: null };
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
    description: "Membaca performa model FUZZY dan GWO pada topologi yang tidak digunakan dalam optimasi.",
    breadcrumb: "Validasi model",
  },
  membership: {
    title: "Fungsi keanggotaan",
    description: "Melihat cara energi, jarak, dan jumlah tetangga diterjemahkan menjadi skor kandidat cluster head.",
    breadcrumb: "Fungsi keanggotaan",
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
  $("#pageDescription").textContent = copy.description;
  $("#breadcrumb").innerHTML = `Ruang analisis <span class="mx-1 text-slate-300">/</span> <span class="text-ink">${escapeHtml(copy.breadcrumb)}</span>`;
  $("#downloadPrimary").classList.toggle("hidden", view !== "hasil");
  window.scrollTo({ top: 0, behavior: "auto" });
  if (view === "hasil") setTimeout(() => renderLifetimeChart(state.dashboard?.summary || []), 0);
  if (view === "validasi") setTimeout(() => renderValidationChart(state.dashboard?.validation || []), 0);
  if (view === "membership") setTimeout(() => renderMembershipCharts(state.dashboard?.membership, state.dashboard?.membership_baseline, state.dashboard?.membership_ranges), 0);
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
    title: { display: true, text: "Seed topologi", color: axisColor, font: { size: 13 } },
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
  $("#validationSeedTableTitle").textContent = `Nilai tiap seed · ${label}`;
  $("#validationSeedDataTable").innerHTML = makeTable([
    { key: "seed", label: "Seed topologi", markup: '<abbr title="Angka awal acak untuk mengulang susunan node">Seed topologi</abbr>' },
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
}

function updateDatasetDescription(dataset) {
  $("#datasetDescription").textContent = dataset?.description || "Data eksperimen yang dipilih.";
}

async function loadDashboard(datasetId = state.datasetId) {
  state.datasetId = datasetId;
  setError("");
  setLoading(true);
  try {
    const response = await authenticatedFetch(`/api/dashboard?dataset=${encodeURIComponent(datasetId)}`, { headers: { Accept: "application/json" } });
    const data = await readApiResponse(response, "Data eksperimen tidak dapat dimuat.");
    state.dashboard = data;
    updateDatasetDescription(data.dataset);
    renderSummary(data.summary);
    renderHistoryChart(data.history);
    renderValidation(data.validation);
    renderMembershipCharts(data.membership, data.membership_baseline, data.membership_ranges);
    $("#historyDataDetails").dataset.loaded = "false";
    $("#historyDataTable").innerHTML = "";
  } catch (error) {
    setConnectionStatus("Data tidak tersedia", false);
    setError(requestErrorMessage(error, "Data eksperimen tidak dapat dimuat."));
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
  $("#downloadSimulation").addEventListener("click", () => {
    downloadFile("round_metrics.csv", toCsv(state.simulation?.history || []), "text/csv;charset=utf-8");
  });
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

    $("#accountEmail").textContent = session.user.email || "Akun aktif";
    $("#accountEmail").title = session.user.email || "Akun aktif";
    const response = await authenticatedFetch("/api/datasets", { headers: { Accept: "application/json" } });
    const data = await readApiResponse(response, "Daftar dataset tidak dapat dimuat.");
    setConnectionStatus("Terhubung");
    state.datasets = data.datasets;
    state.datasetId = data.default || "results";
    $("#datasetSelect").innerHTML = state.datasets.map((dataset) => `<option value="${escapeHtml(dataset.id)}">${escapeHtml(dataset.label)}</option>`).join("");
    $("#datasetSelect").value = state.datasetId;
    bindEvents();
    const route = location.hash.slice(1);
    const initialView = viewText[route] ? route : "hasil";
    if (!viewText[route]) history.replaceState(null, "", `#${initialView}`);
    $("#dashboardApp").classList.remove("hidden");
    $("#authGate").classList.add("hidden");
    setView(initialView);
    await loadDashboard(state.datasetId);
  } catch (error) {
    $("#authGateMessage").textContent = requestErrorMessage(error, "Akses dashboard belum dapat diperiksa.");
    $("#authGateLogin").classList.remove("hidden");
  }
}

start();

