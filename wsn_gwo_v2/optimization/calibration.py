from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from ..config import OptimizerConfig, SimulationConfig
from ..fuzzy import MFEncoder, MembershipSet
from .fitness import FitnessEvaluator, FitnessResult, FitnessWeights
from .gwo import GWOResult, GreyWolfOptimizer


@dataclass
class CalibrationReport:
    """Inputs and results needed to understand and reproduce a calibration."""

    manual: FitnessResult
    warm_start: FitnessResult
    best: FitnessResult
    membership: MembershipSet
    vector: np.ndarray
    optimizer_result: GWOResult
    wolf_evaluations: list[dict[str, object]]
    mode: str
    weights: FitnessWeights
    simulation_config: SimulationConfig
    optimizer_config: OptimizerConfig

    def save(self, output_dir: str | Path) -> dict[str, Path]:
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        paths = {
            "membership": self.membership.save(output / "membership_gwo.json"),
        }
        paths["history"] = self._save_history(output)
        paths["wolf_history"] = self._save_wolf_history(output)
        from ..visualization import ResultPlotter

        plotter = ResultPlotter(output)
        paths["wolf_fitness_plot"] = plotter.save_wolf_fitness(self.wolf_evaluations)
        paths["final_wolves"] = self._save_final_wolves(output)
        paths["best_solution"] = self._save_best_solution(output)
        paths["report"] = self._save_report(output)
        return paths

    def _save_history(self, output: Path) -> Path:
        path = output / "gwo_history.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=("iteration", "best_fitness", "mean_fitness"),
            )
            writer.writeheader()
            writer.writerows(self.optimizer_result.history)
        return path

    def _save_wolf_history(self, output: Path) -> Path:
        path = output / "gwo_wolf_fitness.csv"
        coordinate_fields = tuple(
            f"mf_coordinate_{index:02d}" for index in range(1, 14)
        )
        fieldnames = (
            "id", "no_iterasi", "iteration", "wolf", "rank", "role", "fitness",
            "fnd", "r10", "hnd", "r90", "lnd",
            "peak_residual", "mean_residual", "pdr_pct", "horizon",
            "fitness_seed_count", "fitness_seeds", *coordinate_fields,
        )
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for evaluation_id, row in enumerate(self.wolf_evaluations, start=1):
                writer.writerow({
                    "id": evaluation_id,
                    "no_iterasi": row["iteration"],
                    **row,
                })
        return path

    def _save_final_wolves(self, output: Path) -> Path:
        final_iteration = max(int(row["iteration"]) for row in self.wolf_evaluations)
        final_rows = [
            row for row in self.wolf_evaluations
            if int(row["iteration"]) == final_iteration
        ]
        path = output / "gwo_final_wolves.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(final_rows[0].keys()))
            writer.writeheader()
            writer.writerows(final_rows)

        from ..visualization import ResultPlotter

        plotter = ResultPlotter(output / "gwo_final_wolf_plots")
        baseline = MembershipSet.default()
        encoder = MFEncoder()
        for row in final_rows:
            vector = np.asarray([
                row[f"mf_coordinate_{index:02d}"]
                for index in range(1, encoder.dimension + 1)
            ], dtype=float)
            membership = encoder.decode(vector)
            plotter.save_final_wolf_report(row, membership, baseline)
        return path

    def _save_best_solution(self, output: Path) -> Path:
        identified_rows = [
            {
                "id": evaluation_id,
                "no_iterasi": row["iteration"],
                **row,
            }
            for evaluation_id, row in enumerate(self.wolf_evaluations, start=1)
        ]
        best_row = max(identified_rows, key=lambda row: float(row["fitness"]))
        best_by_wolf = {}
        for row in identified_rows:
            wolf_id = int(row["wolf"])
            previous = best_by_wolf.get(wolf_id)
            if previous is None or (
                float(row["fitness"]), int(row["iteration"])
            ) > (
                float(previous["fitness"]), int(previous["iteration"])
            ):
                best_by_wolf[wolf_id] = row
        best_by_wolf[int(best_row["wolf"])] = best_row
        summary_rows = [best_by_wolf[wolf_id] for wolf_id in sorted(best_by_wolf)]
        for row in summary_rows:
            row["selected_global_best"] = row["id"] == best_row["id"]

        path = output / "gwo_best_solution.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=[*summary_rows[0].keys()],
            )
            writer.writeheader()
            writer.writerows(summary_rows)

        from ..visualization import ResultPlotter

        encoder = MFEncoder()
        vector = np.asarray([
            best_row[f"mf_coordinate_{index:02d}"]
            for index in range(1, encoder.dimension + 1)
        ], dtype=float)
        ResultPlotter(output).save_final_wolf_report(
            best_row,
            encoder.decode(vector),
            MembershipSet.default(),
            filename="gwo_best_solution.png",
            solution_label="Global best sepanjang optimasi",
        )
        return path

    def _save_report(self, output: Path) -> Path:
        data = {
            "fitness_mode": self.mode,
            "weights": self.weights.as_dict(),
            "wolves": self.optimizer_result.wolves,
            "iterations": self.optimizer_result.iterations,
            "evaluations": self.optimizer_result.evaluations,
            "elapsed_seconds": round(self.optimizer_result.elapsed_seconds, 3),
            "best_vector": [float(value) for value in self.vector],
            "simulation_config": asdict(self.simulation_config),
            "fitness_rounds": self.optimizer_config.fitness_rounds,
            "fitness_seeds": list(self.optimizer_config.fitness_seeds),
            "optimizer_seed": self.optimizer_config.seed,
            "manual": self.manual.as_dict(),
            "warm_start": self.warm_start.as_dict(),
            "best": self.best.as_dict(),
        }
        path = output / "calibration_report.json"
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return path


class MFOptimizer:
    """Connects the GWO search to membership encoding and WSN fitness."""

    def __init__(
        self,
        simulation_config: SimulationConfig,
        optimizer_config: OptimizerConfig,
    ) -> None:
        self.simulation_config = simulation_config
        self.optimizer_config = optimizer_config
        self.encoder = MFEncoder()
        self.fitness_evaluator = FitnessEvaluator(simulation_config, optimizer_config)

    def run(self) -> CalibrationReport:
        manual = self.fitness_evaluator.evaluate(MembershipSet.default())
        starting_vector = self.encoder.reference_vector()
        warm_start = self.fitness_evaluator.evaluate(
            self.encoder.decode(starting_vector)
        )

        objective = _CachedMFFitness(self.encoder, self.fitness_evaluator)
        search = GreyWolfOptimizer(
            objective=objective,
            dimension=self.encoder.dimension,
            wolves=self.optimizer_config.wolves,
            iterations=self.optimizer_config.iterations,
            seed=self.optimizer_config.seed,
            maximize=True,
            warm_start=starting_vector,
        )
        optimizer_result = search.optimize()
        wolf_evaluations = []
        for candidate in optimizer_result.population_history:
            position = candidate["position"]
            details = objective.result_for(position)
            row = {key: value for key, value in candidate.items() if key != "position"}
            row.update({
                "fitness": details.score,
                "fnd": details.fnd,
                "r10": details.r10,
                "hnd": details.hnd,
                "r90": details.r90,
                "lnd": details.lnd,
                "peak_residual": details.peak_residual,
                "mean_residual": details.mean_residual,
                "pdr_pct": details.pdr_pct,
                "horizon": details.horizon,
                "fitness_seed_count": len(self.optimizer_config.fitness_seeds),
                "fitness_seeds": ",".join(
                    str(seed) for seed in self.optimizer_config.fitness_seeds
                ),
            })
            row.update({
                f"mf_coordinate_{index:02d}": float(value)
                for index, value in enumerate(position, start=1)
            })
            wolf_evaluations.append(row)

        best_membership = self.encoder.decode(optimizer_result.best_position)
        best = self.fitness_evaluator.evaluate(best_membership)

        return CalibrationReport(
            manual=manual,
            warm_start=warm_start,
            best=best,
            membership=best_membership,
            vector=optimizer_result.best_position.copy(),
            optimizer_result=optimizer_result,
            wolf_evaluations=wolf_evaluations,
            mode=self.optimizer_config.mode,
            weights=self.fitness_evaluator.weights,
            simulation_config=self.simulation_config,
            optimizer_config=self.optimizer_config,
        )


class _CachedMFFitness:
    """Memoizes repeated candidate vectors during one GWO calibration."""

    def __init__(
        self,
        encoder: MFEncoder,
        evaluator: FitnessEvaluator,
    ) -> None:
        self.encoder = encoder
        self.evaluator = evaluator
        self._results: dict[bytes, FitnessResult] = {}

    def __call__(self, vector: np.ndarray) -> float:
        key = np.round(vector, 10).tobytes()
        if key not in self._results:
            membership = self.encoder.decode(vector)
            self._results[key] = self.evaluator.evaluate(membership)
        return self._results[key].score

    def result_for(self, vector: np.ndarray) -> FitnessResult:
        self(vector)
        key = np.round(vector, 10).tobytes()
        return self._results[key]

