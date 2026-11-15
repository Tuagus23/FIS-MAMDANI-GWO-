from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

from ..fuzzy import (
    DISTANCE_LABELS,
    ENERGY_LABELS,
    NEIGHBOR_LABELS,
    OUTPUT_LABELS,
    FuzzyRuleBase,
    MembershipSet,
)
from ..wsn.models import SimulationSummary


class ResultPlotter:
    """Creates membership, rule-base, lifetime, and PDR plots."""

    def __init__(self, output_dir: str | Path) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save_comparison(
        self,
        summaries: list[SimulationSummary],
        horizon: int,
    ) -> list[Path]:
        if not summaries:
            return []
        return [
            self._save_lifetime_chart(summaries, horizon),
            self._save_pdr_chart(summaries),
        ]

    def save_wolf_fitness(self, rows: list[dict[str, object]]) -> Path:
        """Plot each wolf's evaluated fitness at initialization and each update."""
        figure, axis = plt.subplots(figsize=(9, 5), layout="constrained")
        wolf_ids = sorted({int(row["wolf"]) for row in rows})
        for wolf_id in wolf_ids:
            wolf_rows = sorted(
                (row for row in rows if int(row["wolf"]) == wolf_id),
                key=lambda row: int(row["iteration"]),
            )
            axis.plot(
                [int(row["iteration"]) for row in wolf_rows],
                [float(row["fitness"]) for row in wolf_rows],
                marker="o",
                markersize=3,
                linewidth=1.2,
                label=f"Wolf {wolf_id}",
            )
        axis.set_title("Fitness setiap wolf selama optimasi GWO")
        axis.set_xlabel("Iterasi GWO (0 = populasi awal)")
        axis.set_ylabel("Fitness evaluasi")
        axis.set_xticks(sorted({int(row["iteration"]) for row in rows}))
        axis.grid(alpha=0.25)
        axis.set_axisbelow(True)
        axis.legend(title="Wolf", ncol=2)
        path = self.output_dir / "gwo_wolf_fitness.png"
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

    def save_final_wolf_report(
        self,
        row: dict[str, object],
        membership: MembershipSet,
        baseline: MembershipSet,
        filename: str | None = None,
        solution_label: str | None = None,
    ) -> Path:
        """Show one final wolf's input curves and evaluated lifetime metrics."""
        figure, axes = plt.subplots(2, 2, figsize=(13, 9), layout="constrained")
        variable_specs = (
            ("energy", "Energi tersisa (fraksi)", (0.0, 1.0), ENERGY_LABELS),
            ("distance", "Jarak ke base station (m)", (0.0, 100.0), DISTANCE_LABELS),
            ("neighbors", "Jumlah tetangga", (0.0, 20.0), NEIGHBOR_LABELS),
        )
        colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]

        for axis, (name, x_label, domain, labels) in zip(axes.flat[:3], variable_specs):
            x_values = np.linspace(domain[0], domain[1], 501)
            baseline_group = getattr(baseline, name)
            wolf_group = getattr(membership, name)
            for label_index, label in enumerate(labels):
                color = colors[label_index % len(colors)]
                axis.plot(
                    x_values,
                    baseline_group[label].degree_array(x_values),
                    color=color,
                    linestyle="--",
                    alpha=0.65,
                    linewidth=1.2,
                    label=f"{label} · manual",
                )
                axis.plot(
                    x_values,
                    wolf_group[label].degree_array(x_values),
                    color=color,
                    linewidth=2.0,
                    label=f"{label} · wolf",
                )
            axis.set_title({
                "energy": "MF energi",
                "distance": "MF jarak",
                "neighbors": "MF jumlah tetangga",
            }[name])
            axis.set_xlabel(x_label)
            axis.set_ylabel("Derajat keanggotaan")
            axis.set_xlim(*domain)
            axis.set_ylim(-0.03, 1.05)
            axis.grid(alpha=0.25)
            axis.set_axisbelow(True)
            axis.legend(fontsize=7, ncol=2)

        lifetime_axis = axes.flat[3]
        milestones = (
            ("FND", "fnd"),
            ("R10", "r10"),
            ("HND", "hnd"),
            ("R90", "r90"),
            ("LND", "lnd"),
        )
        horizon = float(row["horizon"])
        values = [float(row[field]) for _, field in milestones]
        y_positions = np.arange(len(milestones))
        bars = lifetime_axis.barh(y_positions, values, color="#4472C4")
        lifetime_axis.set_yticks(y_positions, [name for name, _ in milestones])
        lifetime_axis.invert_yaxis()
        lifetime_axis.set_xlim(0.0, horizon * 1.12)
        lifetime_axis.set_xlabel("Round saat milestone kematian tercapai")
        lifetime_axis.set_title("Hasil lifetime evaluasi fitness")
        lifetime_axis.axvline(horizon, color="black", linestyle=":", linewidth=1)
        lifetime_axis.grid(axis="x", alpha=0.25)
        lifetime_axis.set_axisbelow(True)
        for bar, value in zip(bars, values):
            label = f"≥{horizon:.0f}" if value >= horizon else f"{value:.1f}"
            lifetime_axis.annotate(
                label,
                (value, bar.get_y() + bar.get_height() / 2.0),
                xytext=(4, 0),
                textcoords="offset points",
                va="center",
                fontsize=8,
            )

        wolf_id = int(row["wolf"])
        role = str(row["role"]).upper()
        iteration = int(row["iteration"])
        heading = solution_label or f"Populasi akhir · iterasi {iteration}"
        figure.suptitle(
            f"{heading} · Wolf {wolf_id:02d} · {role} · "
            f"Fitness {float(row['fitness']):.6f}\n"
            f"PDR {float(row['pdr_pct']):.3f}% · "
            f"Energi puncak {float(row['peak_residual']):.6f} · "
            f"Seed fitness: {row['fitness_seeds']}\n"
            "Putus-putus: MF manual · Garis penuh: wolf · Output dan aturan tetap",
            fontsize=12,
        )
        path = self.output_dir / (filename or f"wolf_{wolf_id:02d}_final.png")
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

    def save_membership_functions(
        self,
        baseline: MembershipSet,
        calibrated: MembershipSet | None = None,
    ) -> list[Path]:
        """Plot each FIS variable, overlaying calibrated input MFs when supplied."""
        variable_specs = (
            ("energy", "Energi tersisa (fraksi)", (0.0, 1.0), ENERGY_LABELS),
            ("distance", "Jarak ke base station (m)", (0.0, 100.0), DISTANCE_LABELS),
            ("neighbors", "Jumlah tetangga", (0.0, 20.0), NEIGHBOR_LABELS),
            ("output", "Skor kelayakan CH", (0.0, 1.0), OUTPUT_LABELS),
        )
        return [
            self._save_membership_plot(
                name, x_label, domain, labels, baseline, calibrated
            )
            for name, x_label, domain, labels in variable_specs
        ]

    def _save_membership_plot(
        self,
        name: str,
        x_label: str,
        domain: tuple[float, float],
        labels: tuple[str, ...],
        baseline: MembershipSet,
        calibrated: MembershipSet | None,
    ) -> Path:
        x_values = np.linspace(domain[0], domain[1], 501)
        baseline_group = getattr(baseline, name)
        calibrated_group = getattr(calibrated, name) if calibrated is not None else None
        colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]
        figure, axis = plt.subplots(figsize=(8, 4.5), layout="constrained")

        for label_index, label in enumerate(labels):
            color = colors[label_index % len(colors)]
            axis.plot(
                x_values,
                baseline_group[label].degree_array(x_values),
                color=color,
                linestyle="-",
                label=f"{label} · baseline" if calibrated is not None else label,
            )
            if calibrated_group is not None and calibrated_group[label] != baseline_group[label]:
                axis.plot(
                    x_values,
                    calibrated_group[label].degree_array(x_values),
                    color=color,
                    linestyle="--",
                    label=f"{label} · GWO",
                )

        variable_names = {
            "energy": "Energi",
            "distance": "Jarak",
            "neighbors": "Jumlah tetangga",
            "output": "Kelayakan CH",
        }
        suffix = " (tetap)" if name == "output" else ""
        title = f"Kurva MF FIS: {variable_names[name]}{suffix}"
        axis.set_title(title)
        axis.set_xlabel(x_label)
        axis.set_ylabel("Tingkat keanggotaan")
        axis.set_xlim(*domain)
        axis.set_ylim(-0.03, 1.05)
        axis.grid(alpha=0.25)
        axis.set_axisbelow(True)
        axis.legend(title="MF")
        path = self.output_dir / f"mf_{name}.png"
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

    def save_rule_base(self, rule_base: FuzzyRuleBase | None = None) -> Path:
        """Render the complete 27-rule table as a PNG."""
        rules = (rule_base or FuzzyRuleBase.standard()).rules
        figure, axis = plt.subplots(figsize=(8, 10), layout="constrained")
        axis.axis("off")
        axis.set_title("Basis aturan fuzzy (27 aturan)", pad=12)
        table = axis.table(
            cellText=[
                [rule.energy, rule.distance, rule.neighbors, rule.output]
                for rule in rules
            ],
            colLabels=("Energi", "Jarak", "Tetangga", "Output"),
            cellLoc="center",
            loc="center",
        )
        table.auto_set_font_size(False)
        table.set_fontsize(8)
        table.scale(1.0, 1.25)
        path = self.output_dir / "fuzzy_rule_base.png"
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

    def _save_lifetime_chart(
        self,
        summaries: list[SimulationSummary],
        horizon: int,
    ) -> Path:
        metric_names = ("FND", "HND", "LND")
        metric_fields = ("fnd", "hnd", "lnd")
        positions = np.arange(len(metric_names), dtype=float)
        group_width = 0.8
        bar_width = group_width / len(summaries)
        figure, axis = plt.subplots(figsize=(9, 5), layout="constrained")

        for protocol_index, summary in enumerate(summaries):
            offset = (protocol_index - (len(summaries) - 1) / 2.0) * bar_width
            values = [getattr(summary, field) for field in metric_fields]
            plotted_values = [float(value) if value is not None else np.nan for value in values]
            bars = axis.bar(
                positions + offset,
                plotted_values,
                width=bar_width * 0.9,
                label=summary.protocol,
            )
            for metric_index, (bar, value) in enumerate(zip(bars, values)):
                if value is None:
                    axis.text(
                        positions[metric_index] + offset,
                        horizon * 0.04,
                        "n/r",
                        ha="center",
                        va="bottom",
                        rotation=90,
                        fontsize=8,
                    )
                else:
                    axis.annotate(
                        str(value),
                        (bar.get_x() + bar.get_width() / 2.0, float(value)),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha="center",
                        va="bottom",
                        fontsize=8,
                    )

        axis.set_title("Network lifetime milestones")
        axis.set_ylabel("Round")
        axis.set_xlabel("First / half / last node death")
        axis.set_xticks(positions, metric_names)
        axis.set_xlim(-0.5, len(metric_names) - 0.5)
        axis.set_ylim(0, max(1, horizon * 1.12))
        axis.grid(axis="y", alpha=0.25)
        axis.set_axisbelow(True)
        axis.legend(title="Protocol")
        path = self.output_dir / "lifetime_metrics.png"
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

    def _save_pdr_chart(self, summaries: list[SimulationSummary]) -> Path:
        names = [summary.protocol for summary in summaries]
        values = [summary.pdr_total_pct for summary in summaries]
        figure, axis = plt.subplots(figsize=(8, 5), layout="constrained")
        bars = axis.bar(names, values)
        axis.set_title("Packet delivery ratio")
        axis.set_ylabel("PDR (%)")
        axis.set_ylim(0, 110)
        axis.grid(axis="y", alpha=0.25)
        axis.set_axisbelow(True)
        for bar, value in zip(bars, values):
            axis.annotate(
                f"{value:.2f}%",
                (bar.get_x() + bar.get_width() / 2.0, value),
                xytext=(0, 4),
                textcoords="offset points",
                ha="center",
                va="bottom",
            )
        path = self.output_dir / "pdr_comparison.png"
        figure.savefig(path, dpi=160)
        plt.close(figure)
        return path

