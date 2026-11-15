from __future__ import annotations

import csv
from dataclasses import asdict
from pathlib import Path

from .config import OptimizerConfig, SimulationConfig
from .fuzzy import FuzzyRuleBase, MembershipSet
from .optimization import CalibrationReport, MFOptimizer
from .visualization import ResultPlotter
from .wsn import NetworkSimulator, SimulationSummary, create_topology


class ResultWriter:
    """Writes run summaries and round-level records as CSV files."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_protocol_summaries(self, summaries: list[SimulationSummary]) -> Path:
        rows = [asdict(summary) for summary in summaries]
        return self._write_csv("protocol_summary.csv", rows)

    def write_round_metrics(self, round_metrics: list[dict]) -> Path:
        return self._write_csv("round_metrics.csv", round_metrics)

    def write_validation(self, rows: list[dict]) -> Path:
        return self._write_csv("validation.csv", rows)

    def write_validation_summary(self, rows: list[dict]) -> Path:
        return self._write_csv("validation_summary.csv", rows)

    def write_rule_base(self, rule_base: FuzzyRuleBase) -> Path:
        rows = [asdict(rule) for rule in rule_base.rules]
        return self._write_csv("fuzzy_rules.csv", rows)

    def _write_csv(self, filename: str, rows: list[dict]) -> Path:
        path = self.output_dir / filename
        if not rows:
            return path
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return path


class TopologyValidator:
    """Compares manual and calibrated fuzzy selectors on unseen topologies."""

    def __init__(
        self,
        config: SimulationConfig,
        calibrated_membership: MembershipSet,
        result_writer: ResultWriter,
    ) -> None:
        self.config = config
        self.calibrated_membership = calibrated_membership
        self.result_writer = result_writer

    def run(self, topology_count: int) -> list[dict]:
        rows = []
        for index in range(topology_count):
            seed = self.config.seed + 101 * (index + 1)
            topology = create_topology(self.config, seed)
            row = {"seed": seed}
            row.update(self._compare_on_topology(topology))
            rows.append(row)
        self.result_writer.write_validation(rows)
        self.result_writer.write_validation_summary(self._summarize(rows))
        return rows

    def _summarize(self, rows: list[dict]) -> list[dict]:
        summary = []
        for metric in ("FND", "HND", "LND", "PDR_pct"):
            fuzzy_values = [self._capped_value(row[f"FUZZY_{metric}"]) for row in rows]
            gwo_values = [self._capped_value(row[f"GWO_{metric}"]) for row in rows]
            summary.append({
                "metric": metric,
                "FUZZY_mean": round(sum(fuzzy_values) / len(rows), 3),
                "GWO_mean": round(sum(gwo_values) / len(rows), 3),
                "mean_delta_GWO_minus_FUZZY": round(
                    (sum(gwo_values) - sum(fuzzy_values)) / len(rows), 3
                ),
                "GWO_wins": sum(gwo > fuzzy for fuzzy, gwo in zip(fuzzy_values, gwo_values)),
                "FUZZY_wins": sum(fuzzy > gwo for fuzzy, gwo in zip(fuzzy_values, gwo_values)),
                "ties": sum(fuzzy == gwo for fuzzy, gwo in zip(fuzzy_values, gwo_values)),
                "seed_count": len(rows),
            })
        fuzzy_lifetime = [
            sum(self._capped_value(row[f"FUZZY_{metric}"]) for metric in ("FND", "HND", "LND"))
            / (3 * self.config.rounds)
            for row in rows
        ]
        gwo_lifetime = [
            sum(self._capped_value(row[f"GWO_{metric}"]) for metric in ("FND", "HND", "LND"))
            / (3 * self.config.rounds)
            for row in rows
        ]
        summary.append({
            "metric": "lifetime_index",
            "FUZZY_mean": round(sum(fuzzy_lifetime) / len(rows), 5),
            "GWO_mean": round(sum(gwo_lifetime) / len(rows), 5),
            "mean_delta_GWO_minus_FUZZY": round(
                (sum(gwo_lifetime) - sum(fuzzy_lifetime)) / len(rows), 5
            ),
            "GWO_wins": sum(gwo > fuzzy for fuzzy, gwo in zip(fuzzy_lifetime, gwo_lifetime)),
            "FUZZY_wins": sum(fuzzy > gwo for fuzzy, gwo in zip(fuzzy_lifetime, gwo_lifetime)),
            "ties": sum(fuzzy == gwo for fuzzy, gwo in zip(fuzzy_lifetime, gwo_lifetime)),
            "seed_count": len(rows),
        })
        return summary

    def _capped_value(self, value: float | None) -> float:
        return float(value) if value is not None else float(self.config.rounds)

    def _compare_on_topology(self, topology) -> dict:
        results = {}
        for protocol in ("FUZZY", "GWO"):
            membership = self.calibrated_membership if protocol == "GWO" else None
            simulation = NetworkSimulator(
                self.config,
                protocol,
                initial_nodes=topology,
                membership=membership,
            )
            simulation.run()
            summary = simulation.summary()
            results.update({
                f"{protocol}_FND": summary.fnd,
                f"{protocol}_HND": summary.hnd,
                f"{protocol}_LND": summary.lnd,
                f"{protocol}_PDR_pct": round(summary.pdr_total_pct, 3),
            })
        return results


class ExperimentRunner:
    """Runs optional calibration, protocol simulations, and output reporting."""

    BASELINE_PROTOCOLS = ("FUZZY", "LEACH")

    def __init__(
        self,
        simulation_config: SimulationConfig,
        output_dir: str | Path,
        optimizer_config: OptimizerConfig | None = None,
        load_membership_path: str | Path | None = None,
        validation_seeds: int = 0,
    ) -> None:
        if optimizer_config is not None and load_membership_path is not None:
            raise ValueError("calibrate or load a membership set, not both")
        if validation_seeds < 0:
            raise ValueError("validation_seeds cannot be negative")
        self.config = simulation_config
        self.output_dir = Path(output_dir)
        self.optimizer_config = optimizer_config
        self.load_membership_path = load_membership_path
        self.validation_seeds = validation_seeds
        self.writer = ResultWriter(self.output_dir)
        self.plotter = ResultPlotter(self.output_dir)

    def run(self) -> list[SimulationSummary]:
        membership, report = self._prepare_membership()
        if report is not None:
            report.save(self.output_dir)
            self._print_calibration(report)

        rule_base = FuzzyRuleBase.standard()
        self.writer.write_rule_base(rule_base)
        plot_paths = self.plotter.save_membership_functions(
            MembershipSet.default(),
            calibrated=membership,
        )
        plot_paths.append(self.plotter.save_rule_base(rule_base))

        summaries, round_rows = self._run_protocols(membership)
        self.writer.write_protocol_summaries(summaries)
        self.writer.write_round_metrics(round_rows)
        plot_paths.extend(self.plotter.save_comparison(summaries, self.config.rounds))
        self._print_summaries(summaries)
        for plot_path in plot_paths:
            print(f"Chart written to: {plot_path.resolve()}")

        if membership is not None and self.validation_seeds:
            TopologyValidator(self.config, membership, self.writer).run(self.validation_seeds)
        print(f"Results written to: {self.output_dir.resolve()}")
        return summaries

    def _prepare_membership(self) -> tuple[MembershipSet | None, CalibrationReport | None]:
        if self.optimizer_config is not None:
            report = MFOptimizer(self.config, self.optimizer_config).run()
            return report.membership, report
        if self.load_membership_path is not None:
            membership = MembershipSet.load(self.load_membership_path)
            print(f"Loaded membership set: {self.load_membership_path}")
            return membership, None
        return None, None

    def _run_protocols(
        self,
        calibrated_membership: MembershipSet | None,
    ) -> tuple[list[SimulationSummary], list[dict]]:
        topology = create_topology(self.config, self.config.seed)
        protocols = list(self.BASELINE_PROTOCOLS)
        if calibrated_membership is not None:
            protocols.insert(2, "GWO")

        summaries = []
        round_rows = []
        for protocol in protocols:
            membership = calibrated_membership if protocol == "GWO" else None
            simulation = NetworkSimulator(
                config=self.config,
                protocol=protocol,
                initial_nodes=topology,
                membership=membership,
            )
            round_rows.extend(asdict(row) for row in simulation.run())
            summaries.append(simulation.summary())
        return summaries, round_rows

    @staticmethod
    def _print_calibration(report: CalibrationReport) -> None:
        result = report.optimizer_result
        print(
            f"GWO calibration ({report.mode}): "
            f"manual={report.manual.score:.6f}, "
            f"warm={report.warm_start.score:.6f}, "
            f"best={report.best.score:.6f}; "
            f"{result.evaluations} evaluations"
        )

    @staticmethod
    def _print_summaries(summaries: list[SimulationSummary]) -> None:
        for summary in summaries:
            print(
                f"{summary.protocol:7s} "
                f"FND={summary.fnd} HND={summary.hnd} "
                f"LND={summary.lnd} PDR={summary.pdr_total_pct:.3f}%"
            )

