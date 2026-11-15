from __future__ import annotations

import json
import tempfile
from dataclasses import asdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from wsn_gwo_v2.config import SimulationConfig
from wsn_gwo_v2.fuzzy import MembershipSet
from wsn_gwo_v2.wsn import NetworkSimulator, create_topology


ROOT = Path(__file__).parent
DATASETS = {
    "Kalibrasi 10 seed": {
        "path": ROOT / "hasil_optimasi_10seed",
        "description": "MF GWO dikalibrasi pada 10 seed dan divalidasi pada 10 topologi.",
    },
    "Eksperimen utama": {
        "path": ROOT / "results",
        "description": "Perbandingan hasil pada konfigurasi eksperimen utama.",
    },
    "Eksperimen seed 42": {
        "path": ROOT / "optimasi_seed42_weight030",
        "description": "Run khusus seed 42; seed ini juga ikut dalam latihan GWO.",
    },
}

st.set_page_config(
    page_title="Fuzzy CH WSN | Dashboard",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      :root { --ink:#172b36; --muted:#627580; --teal:#0d766e; --line:#dce7e7; }
      html, body, [class*="css"] { font-family:'Segoe UI', Inter, sans-serif; color:var(--ink); }
      [data-testid="stAppViewContainer"] { background:#f5f8f7; }
      [data-testid="stSidebar"] { background:#edf3f1; border-right:1px solid var(--line); }
      h1,h2,h3 { font-family:'Segoe UI', Inter, sans-serif !important; letter-spacing:-.035em; }
      .hero { background:linear-gradient(120deg,#103d48,#11786f); color:#f5fffc; padding:26px 30px; border-radius:18px; margin:4px 0 24px; }
      .hero-kicker { color:#9de5d4; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
      .hero h1 { color:white; margin:7px 0 6px; font-size:31px; }
      .hero p { color:#d6efeb; margin:0; max-width:760px; font-size:15px; }
      .section-label { color:var(--teal); text-transform:uppercase; letter-spacing:.12em; font-size:11px; font-weight:700; }
      div[data-testid="stMetric"] { background:white; border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
      div[data-testid="stMetricLabel"] { color:var(--muted); }
      div[data-testid="stMetricValue"] { color:var(--ink); font-family:'Segoe UI',Inter,sans-serif; }
      .note { background:#e8f3f0; border-left:3px solid var(--teal); border-radius:4px 10px 10px 4px; padding:12px 15px; color:#30545a; font-size:13px; }
      .stTabs [data-baseweb="tab-list"] { gap:18px; }
      .stTabs [data-baseweb="tab"] { padding-left:2px; padding-right:2px; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
      <div class="hero-kicker">Wireless Sensor Network · Mamdani + GWO</div>
      <h1>Fuzzy Cluster Head Dashboard</h1>
      <p>Jelajahi hasil simulasi, validasi topologi, dan pengaruh kalibrasi fungsi keanggotaan terhadap umur jaringan.</p>
    </div>
    """,
    unsafe_allow_html=True,
)


def read_csv(path: Path) -> pd.DataFrame | None:
    return pd.read_csv(path) if path.is_file() else None


def membership_value(shape: str, points: list[float], x: np.ndarray) -> np.ndarray:
    if shape == "tri":
        a, b, c = points
        left = np.where(x < a, 0.0, 1.0) if b == a else (x - a) / (b - a)
        right = np.where(x > c, 0.0, 1.0) if c == b else (c - x) / (c - b)
        return np.maximum(0.0, np.minimum(np.minimum(left, right), 1.0))
    a, b, c, d = points
    left = np.where(x < a, 0.0, 1.0) if b == a else (x - a) / (b - a)
    right = np.where(x > d, 0.0, 1.0) if d == c else (d - x) / (d - c)
    return np.maximum(0.0, np.minimum(np.minimum(left, right), 1.0))


def show_membership_functions(path: Path) -> None:
    membership_path = path / "membership_gwo.json"
    if not membership_path.is_file():
        st.info("Berkas MF terkalibrasi tidak tersedia untuk eksperimen ini.")
        return

    data = json.loads(membership_path.read_text(encoding="utf-8"))
    domains = {
        "energy": ("Energi sisa", 0.0, 1.0),
        "distance": ("Jarak ke base station (m)", 0.0, 100.0),
        "neighbors": ("Jumlah tetangga", 0.0, 20.0),
        "output": ("Skor kelayakan CH", 0.0, 1.0),
    }
    colors = ["#168b7f", "#e2a343", "#437ab5"]
    fig, axes = plt.subplots(2, 2, figsize=(10, 6.3), constrained_layout=True)
    fig.patch.set_facecolor("#f5f8f7")
    for axis, (key, (title, low, high)) in zip(axes.flat, domains.items()):
        x = np.linspace(low, high, 240)
        axis.set_facecolor("white")
        for (label, spec), color in zip(data[key].items(), colors):
            y = membership_value(spec["shape"], spec["points"], x)
            axis.plot(x, y, color=color, linewidth=2.5, label=label)
            axis.fill_between(x, y, color=color, alpha=0.07)
        axis.set_title(title, loc="left", fontsize=11, fontweight="bold", color="#172b36")
        axis.set_ylim(-0.03, 1.05)
        axis.grid(axis="y", color="#e7eeee", linewidth=0.8)
        axis.spines[["top", "right"]].set_visible(False)
        axis.spines[["left", "bottom"]].set_color("#dce7e7")
        axis.tick_params(colors="#627580", labelsize=9)
        axis.legend(frameon=False, fontsize=8, ncol=3, loc="upper center")
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)


def show_summary(summary: pd.DataFrame) -> None:
    if summary.empty:
        st.warning("Belum ada ringkasan protokol pada folder ini.")
        return
    summary = summary.copy()
    summary["protocol"] = summary["protocol"].astype(str)
    lnd_rows = summary.dropna(subset=["lnd"])
    best_lnd = lnd_rows.loc[lnd_rows["lnd"].idxmax()] if not lnd_rows.empty else None
    best_pdr = summary.loc[summary["pdr_total_pct"].idxmax()]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Protokol dibandingkan", len(summary))
    c2.metric("Round maksimum", f"{int(summary['last_round'].max()):,}")
    c3.metric(
        "LND tertinggi",
        f"{int(best_lnd['lnd']):,}" if best_lnd is not None else "Belum tercapai",
        str(best_lnd["protocol"]) if best_lnd is not None else None,
    )
    c4.metric("PDR tertinggi", f"{best_pdr['pdr_total_pct']:.2f}%", str(best_pdr["protocol"]))

    left, right = st.columns([1.35, 1])
    with left:
        st.subheader("Umur jaringan")
        chart_data = summary.set_index("protocol")[["fnd", "hnd", "lnd"]].rename(
            columns={"fnd": "FND · node pertama mati", "hnd": "HND · 50% node mati", "lnd": "LND · node terakhir mati"}
        )
        st.bar_chart(chart_data, height=300, color=["#e2a343", "#437ab5", "#168b7f"])
    with right:
        st.subheader("Packet delivery ratio")
        pdr = summary.set_index("protocol")[["pdr_total_pct"]].rename(columns={"pdr_total_pct": "PDR (%)"})
        st.bar_chart(pdr, height=300, color="#168b7f")
        st.caption("PDR dihitung dari pembacaan sensor yang berhasil tiba di base station.")

    st.subheader("Ringkasan per protokol")
    display = summary.rename(
        columns={
            "protocol": "Protokol", "last_round": "Round terakhir", "fnd": "FND", "r10": "R10",
            "hnd": "HND", "r90": "R90", "lnd": "LND", "alive_nodes_last": "Node hidup",
            "residual_energy_last_j": "Energi sisa (J)", "pdr_total_pct": "PDR (%)",
        }
    )
    st.dataframe(display, hide_index=True, use_container_width=True)
    st.download_button(
        "Unduh ringkasan CSV",
        summary.to_csv(index=False).encode("utf-8"),
        file_name="protocol_summary.csv",
        mime="text/csv",
    )


def run_comparison(config: SimulationConfig, membership: MembershipSet) -> tuple[pd.DataFrame, pd.DataFrame]:
    topology = create_topology(config, config.seed)
    summaries = []
    rounds = []
    for protocol in ("FUZZY", "LEACH", "GWO"):
        simulation = NetworkSimulator(
            config,
            protocol,
            initial_nodes=topology,
            membership=membership if protocol == "GWO" else None,
        )
        rows = simulation.run()
        summaries.append(asdict(simulation.summary()))
        rounds.extend({"protocol": protocol, **asdict(row)} for row in rows)
    return pd.DataFrame(summaries), pd.DataFrame(rounds)


with st.sidebar:
    st.markdown("### 📡 Navigasi")
    page = st.radio("Halaman", ["Hasil tersimpan", "Eksperimen baru", "Tentang metode"], label_visibility="collapsed")
    st.divider()
    st.caption("Fuzzy CH WSN · versi 2")
    st.caption("Model dan data bersumber dari simulasi lokal projek.")


if page == "Hasil tersimpan":
    st.markdown('<div class="section-label">Jelajah hasil</div>', unsafe_allow_html=True)
    dataset_name = st.selectbox("Pilih eksperimen", list(DATASETS))
    dataset = DATASETS[dataset_name]
    result_dir = dataset["path"]
    st.markdown(f'<div class="note">{dataset["description"]}</div>', unsafe_allow_html=True)

    summary = read_csv(result_dir / "protocol_summary.csv")
    if summary is None:
        st.error("Berkas hasil tidak ditemukan. Periksa data yang disertakan saat deployment.")
    else:
        show_summary(summary)
        tabs = st.tabs(["Validasi topologi", "Fungsi keanggotaan", "Berkas"])
        with tabs[0]:
            validation = read_csv(result_dir / "validation_summary.csv")
            if validation is None:
                st.info("Eksperimen ini tidak memiliki ringkasan validasi topologi.")
            else:
                st.subheader("FUZZY dibanding GWO pada topologi baru")
                st.caption("Milestone yang belum tercapai dihitung pada batas horizon simulasi.")
                st.dataframe(validation, hide_index=True, use_container_width=True)
                chart = validation[validation["metric"].isin(["FND", "HND", "LND"])].set_index("metric")[["FUZZY_mean", "GWO_mean"]]
                if not chart.empty:
                    st.bar_chart(chart, height=280, color=["#e2a343", "#168b7f"])
                st.download_button(
                    "Unduh validasi CSV",
                    validation.to_csv(index=False).encode("utf-8"),
                    file_name="validation_summary.csv",
                    mime="text/csv",
                )
        with tabs[1]:
            st.subheader("MF yang dipakai GWO")
            show_membership_functions(result_dir)
            st.caption("Kurva menampilkan fungsi keanggotaan setelah kalibrasi pada data eksperimen terpilih.")
        with tabs[2]:
            st.subheader("Unduhan data")
            for filename, label in (
                ("protocol_summary.csv", "Ringkasan protokol"),
                ("validation.csv", "Hasil validasi per seed"),
                ("membership_gwo.json", "Parameter MF GWO"),
            ):
                path = result_dir / filename
                if path.is_file():
                    st.download_button(label, path.read_bytes(), file_name=filename, key=f"download-{filename}")

elif page == "Eksperimen baru":
    st.markdown('<div class="section-label">Jalankan simulasi</div>', unsafe_allow_html=True)
    st.subheader("Bandingkan tiga protokol")
    st.markdown(
        '<div class="note">GWO memakai fungsi keanggotaan terbaik dari kalibrasi 10 seed. '
        'Kalibrasi ulang tidak dijalankan di server bersama, sehingga run selesai lebih cepat dan konsisten.</div>',
        unsafe_allow_html=True,
    )
    with st.form("simulation-form"):
        c1, c2, c3 = st.columns(3)
        nodes = c1.number_input("Jumlah node", min_value=10, max_value=60, value=30, step=5)
        rounds = c2.number_input("Horizon (round)", min_value=100, max_value=2000, value=1600, step=100)
        seed = c3.number_input("Seed topologi", min_value=0, max_value=999999, value=42, step=1)
        ch_count = st.slider("Jumlah cluster head per round (untuk FUZZY/GWO)", min_value=1, max_value=min(10, int(nodes)), value=1)
        submitted = st.form_submit_button("Jalankan perbandingan", type="primary", use_container_width=True)

    if submitted:
        config = SimulationConfig(nodes=int(nodes), rounds=int(rounds), seed=int(seed), cluster_head_count=int(ch_count))
        membership = MembershipSet.load(ROOT / "hasil_optimasi_10seed" / "membership_gwo.json")
        with st.spinner("Simulasi sedang berjalan…"):
            summary, round_metrics = run_comparison(config, membership)
        st.session_state["latest_run"] = {"summary": summary, "rounds": round_metrics, "config": asdict(config)}

    if "latest_run" in st.session_state:
        result = st.session_state["latest_run"]
        cfg = result["config"]
        st.success(f"Simulasi selesai · {cfg['nodes']} node · {cfg['rounds']:,} round · seed {cfg['seed']}")
        show_summary(result["summary"])
        rounds_df = result["rounds"]
        if not rounds_df.empty and "alive_nodes" in rounds_df.columns:
            st.subheader("Node yang masih hidup per round")
            alive = rounds_df.pivot(index="round_number", columns="protocol", values="alive_nodes")
            st.line_chart(alive, height=280, color=["#168b7f", "#437ab5", "#e2a343"])
        st.download_button(
            "Unduh metrik per round CSV",
            rounds_df.to_csv(index=False).encode("utf-8"),
            file_name="round_metrics.csv",
            mime="text/csv",
        )

else:
    st.markdown('<div class="section-label">Model simulasi</div>', unsafe_allow_html=True)
    st.subheader("Pemilihan cluster head berbasis fuzzy")
    st.markdown(
        "Projek membandingkan pemilihan cluster head menggunakan sistem inferensi fuzzy Mamdani, "
        "LEACH probabilistik, dan Mamdani dengan fungsi keanggotaan yang dikalibrasi Grey Wolf Optimizer."
    )
    a, b, c = st.columns(3)
    a.markdown("#### 01 · FUZZY\n\nMenggunakan aturan Mamdani dan kurva fungsi keanggotaan baseline.")
    b.markdown("#### 02 · LEACH\n\nMemilih cluster head dengan ambang probabilistik dan rotasi.")
    c.markdown("#### 03 · GWO\n\nMemakai kurva input yang dikalibrasi untuk memberi skor kandidat cluster head.")
    st.divider()
    st.markdown("**Milestone umur jaringan**")
    st.markdown("FND = node pertama mati · R10 = 10% mati · HND = 50% mati · R90 = 90% mati · LND = node terakhir mati.")
    st.markdown("**Validasi** membandingkan FUZZY dan GWO pada topologi dengan seed berbeda dari data kalibrasi.")

st.caption("Hasil simulasi adalah keluaran model dengan seed dan konfigurasi yang tercantum; gunakan sebagai pembanding eksperimen, bukan jaminan kinerja jaringan nyata.")

