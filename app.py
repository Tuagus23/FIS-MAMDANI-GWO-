from __future__ import annotations

import json
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
        "description": "MF GWO dilatih dengan 10 seed dan divalidasi pada 10 topologi.",
    },
    "Eksperimen utama": {
        "path": ROOT / "results",
        "description": "Hasil eksperimen utama yang disertakan dalam projek.",
    },
    "Eksperimen seed 42": {
        "path": ROOT / "optimasi_seed42_weight030",
        "description": "Seed 42 ikut dalam latihan GWO, jadi hasil ini bukan uji independen.",
    },
}

st.set_page_config(page_title="Fuzzy CH WSN", page_icon="📡", layout="wide")
st.title("Fuzzy CH WSN")
st.caption("Simulasi pemilihan cluster head · Mamdani, LEACH, dan GWO")

dataset_name = st.selectbox("Dataset hasil", list(DATASETS))
dataset = DATASETS[dataset_name]
result_dir = dataset["path"]
st.caption(dataset["description"])


def read_csv(path: Path) -> pd.DataFrame | None:
    return pd.read_csv(path) if path.is_file() else None


def show_summary(summary: pd.DataFrame, download_key: str) -> None:
    if summary.empty:
        st.info("Belum ada ringkasan untuk eksperimen ini.")
        return

    lifetime = summary.set_index("protocol")[["fnd", "hnd", "lnd"]].rename(
        columns={"fnd": "FND", "hnd": "HND", "lnd": "LND"}
    )
    st.subheader("Umur jaringan")
    st.bar_chart(lifetime, height=280, color=["#d99a38", "#507b91", "#167c72"])

    columns = ["protocol", "last_round", "fnd", "r10", "hnd", "r90", "lnd", "pdr_total_pct"]
    labels = {
        "protocol": "Protokol",
        "last_round": "Round terakhir",
        "fnd": "FND",
        "r10": "R10",
        "hnd": "HND",
        "r90": "R90",
        "lnd": "LND",
        "pdr_total_pct": "PDR (%)",
    }
    table = summary[[column for column in columns if column in summary.columns]].rename(columns=labels)
    st.dataframe(table, hide_index=True, use_container_width=True)
    st.download_button(
        "Unduh ringkasan CSV",
        summary.to_csv(index=False).encode("utf-8"),
        file_name="protocol_summary.csv",
        mime="text/csv",
        key=download_key,
    )


def show_validation(path: Path) -> None:
    validation = read_csv(path / "validation_summary.csv")
    if validation is None:
        st.info("Ringkasan validasi tidak tersedia untuk eksperimen ini.")
        return

    st.subheader("FUZZY dan GWO pada topologi baru")
    st.caption("Nilai milestone yang belum tercapai dihitung pada batas horizon simulasi.")
    milestones = validation[validation["metric"].isin(["FND", "HND", "LND"])]
    if not milestones.empty:
        chart = milestones.set_index("metric")[["FUZZY_mean", "GWO_mean"]]
        st.bar_chart(chart, height=260, color=["#d99a38", "#167c72"])
    st.dataframe(validation, hide_index=True, use_container_width=True)
    st.download_button(
        "Unduh ringkasan validasi CSV",
        validation.to_csv(index=False).encode("utf-8"),
        file_name="validation_summary.csv",
        mime="text/csv",
    )

    raw_validation = path / "validation.csv"
    if raw_validation.is_file():
        st.download_button(
            "Unduh hasil per seed CSV",
            raw_validation.read_bytes(),
            file_name="validation.csv",
            mime="text/csv",
        )


def membership_value(shape: str, points: list[float], x: np.ndarray) -> np.ndarray:
    if shape == "tri":
        a, b, c = points
        left = np.where(x < a, 0.0, 1.0) if b == a else (x - a) / (b - a)
        right = np.where(x > c, 0.0, 1.0) if c == b else (c - x) / (c - b)
        return np.clip(np.minimum(left, right), 0.0, 1.0)

    a, b, c, d = points
    left = np.where(x < a, 0.0, 1.0) if b == a else (x - a) / (b - a)
    right = np.where(x > d, 0.0, 1.0) if d == c else (d - x) / (d - c)
    return np.clip(np.minimum(left, right), 0.0, 1.0)


def show_membership_functions(path: Path) -> None:
    membership_path = path / "membership_gwo.json"
    if not membership_path.is_file():
        st.info("Parameter fungsi keanggotaan tidak tersedia.")
        return

    data = json.loads(membership_path.read_text(encoding="utf-8"))
    domains = {
        "energy": ("Energi sisa", 0.0, 1.0),
        "distance": ("Jarak ke base station (m)", 0.0, 100.0),
        "neighbors": ("Jumlah tetangga", 0.0, 20.0),
        "output": ("Skor kelayakan CH", 0.0, 1.0),
    }
    colors = ["#167c72", "#d99a38", "#507b91"]
    figure, axes = plt.subplots(2, 2, figsize=(10, 6), constrained_layout=True)
    for axis, (key, (title, low, high)) in zip(axes.flat, domains.items()):
        values = np.linspace(low, high, 240)
        for (label, spec), color in zip(data[key].items(), colors):
            curve = membership_value(spec["shape"], spec["points"], values)
            axis.plot(values, curve, color=color, linewidth=2, label=label)
        axis.set(title=title, ylim=(-0.03, 1.05))
        axis.grid(axis="y", alpha=0.2)
        axis.spines[["top", "right"]].set_visible(False)
        axis.legend(frameon=False, fontsize=8, ncol=3)
    st.pyplot(figure, use_container_width=True)
    plt.close(figure)
    st.download_button(
        "Unduh parameter MF JSON",
        membership_path.read_bytes(),
        file_name="membership_gwo.json",
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
        rounds.extend({"protocol": protocol, **asdict(row)} for row in simulation.run())
        summaries.append(asdict(simulation.summary()))
    return pd.DataFrame(summaries), pd.DataFrame(rounds)


results = read_csv(result_dir / "protocol_summary.csv")
page = st.radio(
    "Bagian",
    ["Hasil", "Validasi", "Fungsi keanggotaan", "Simulasi"],
    horizontal=True,
    label_visibility="collapsed",
)

if page == "Hasil":
    if results is None:
        st.error("Ringkasan hasil tidak ditemukan.")
    else:
        show_summary(results, "download-saved-summary")
    with st.expander("Cara membaca metrik"):
        st.write("FND = node pertama mati · R10 = 10% mati · HND = 50% mati · R90 = 90% mati · LND = node terakhir mati.")
        st.write("PDR adalah persentase pembacaan sensor yang berhasil sampai ke base station.")
elif page == "Validasi":
    show_validation(result_dir)
elif page == "Fungsi keanggotaan":
    st.subheader("Fungsi keanggotaan GWO")
    show_membership_functions(result_dir)
else:
    st.subheader("Bandingkan protokol")
    st.caption("GWO memakai MF dari kalibrasi 10 seed. Optimizer tidak dijalankan ulang.")
    with st.form("simulation-form"):
        node_col, round_col, seed_col, heads_col = st.columns(4)
        nodes = node_col.number_input("Node", min_value=10, max_value=60, value=30, step=5)
        rounds = round_col.number_input("Round", min_value=100, max_value=2000, value=1600, step=100)
        seed = seed_col.number_input("Seed", min_value=0, max_value=999999, value=42)
        head_count = heads_col.number_input("Jumlah CH", min_value=1, max_value=10, value=1)
        submitted = st.form_submit_button("Jalankan simulasi", type="primary")

    if submitted:
        config = SimulationConfig(
            nodes=int(nodes),
            rounds=int(rounds),
            seed=int(seed),
            cluster_head_count=int(head_count),
        )
        membership = MembershipSet.load(ROOT / "hasil_optimasi_10seed" / "membership_gwo.json")
        with st.spinner("Simulasi berjalan…"):
            summary, round_metrics = run_comparison(config, membership)
        st.session_state["latest_run"] = {
            "summary": summary,
            "rounds": round_metrics,
            "config": {"nodes": int(nodes), "rounds": int(rounds), "seed": int(seed)},
        }

    if "latest_run" in st.session_state:
        latest = st.session_state["latest_run"]
        config = latest["config"]
        st.success(f"Selesai · {config['nodes']} node · {config['rounds']:,} round · seed {config['seed']}")
        show_summary(latest["summary"], "download-run-summary")

        round_metrics = latest["rounds"]
        if not round_metrics.empty:
            alive_nodes = round_metrics.pivot(
                index="round_number", columns="protocol", values="alive_nodes"
            ).reindex(columns=["FUZZY", "LEACH", "GWO"])
            st.subheader("Node hidup per round")
            st.line_chart(alive_nodes, height=240, color=["#167c72", "#507b91", "#d99a38"])
            st.download_button(
                "Unduh metrik per round CSV",
                round_metrics.to_csv(index=False).encode("utf-8"),
                file_name="round_metrics.csv",
                mime="text/csv",
            )

with st.expander("Tentang model"):
    st.write("FUZZY memakai aturan Mamdani baseline. LEACH memakai ambang probabilistik. GWO menggunakan fungsi keanggotaan input yang dikalibrasi dengan Grey Wolf Optimizer.")
    st.caption("Gunakan hasil sebagai pembanding simulasi; konfigurasi tidak menjamin kinerja jaringan nyata.")

