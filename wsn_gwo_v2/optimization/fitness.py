from __future__ import annotations

from dataclasses import asdict, dataclass, replace

import numpy as np

from ..config import OptimizerConfig, SimulationConfig
from ..fuzzy import MembershipSet
from ..wsn import NetworkSimulator, create_topology


@dataclass(frozen=True)
class FitnessWeights:
    fnd: float
    r10: float
    hnd: float
    r90: float
    lnd: float
    peak_residual: float
    mean_residual: float
    pdr: float

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


@dataclass(frozen=True)
class FitnessResult:
    score: float
    fnd: float
    r10: float
    hnd: float
    r90: float
    lnd: float
    peak_residual: float
    mean_residual: float
    pdr_pct: float
    horizon: int

    def as_dict(self) -> dict:
        return asdict(self)


class FitnessEvaluator:
    """Evaluates one MF set on the same fixed topologies for every candidate."""

    WEIGHTS = {
        "balanced": FitnessWeights(
            fnd=0.10, r10=0.20, hnd=0.25, r90=0.25, lnd=0.00,
            peak_residual=0.00, mean_residual=0.10, pdr=0.10,
        ),
        "lifetime": FitnessWeights(
            fnd=0.30, r10=0.30, hnd=0.30, r90=0.30, lnd=0.30,
            peak_residual=0.30, mean_residual=0.00, pdr=0.30,
        ),
    }

    def __init__(
        self,
        simulation_config: SimulationConfig,
        optimizer_config: OptimizerConfig,
    ) -> None:
        self.config = replace(
            simulation_config,
            rounds=optimizer_config.fitness_rounds,
        )
        self.optimizer_config = optimizer_config
        self.weights = self.WEIGHTS[optimizer_config.mode]
        self.topologies = [
            create_topology(self.config, seed)
            for seed in optimizer_config.fitness_seeds
        ]

    def evaluate(self, membership: MembershipSet) -> FitnessResult:
        summaries = []
        final_energies = []
        for topology in self.topologies:
            simulation = NetworkSimulator(
                config=self.config,
                protocol="GWO",
                initial_nodes=topology,
                membership=membership,
            )
            simulation.run()
            summaries.append(simulation.summary())
            final_energies.append([node.energy_j for node in simulation.nodes])

        metrics = self._average_metrics(summaries, final_energies)
        score = self._weighted_score(metrics)
        return FitnessResult(
            score=score,
            fnd=metrics["fnd"],
            r10=metrics["r10"],
            hnd=metrics["hnd"],
            r90=metrics["r90"],
            lnd=metrics["lnd"],
            peak_residual=metrics["peak_residual"],
            mean_residual=metrics["mean_residual"],
            pdr_pct=metrics["pdr_pct"],
            horizon=self.config.rounds,
        )

    def _average_metrics(self, summaries, final_energies) -> dict[str, float]:
        horizon = self.config.rounds

        def average_round(name: str) -> float:
            values = [getattr(summary, name) for summary in summaries]
            return float(np.mean([
                float(value) if value is not None else float(horizon)
                for value in values
            ]))

        return {
            "fnd": average_round("fnd"),
            "r10": average_round("r10"),
            "hnd": average_round("hnd"),
            "r90": average_round("r90"),
            "lnd": average_round("lnd"),
            "mean_residual": float(np.mean([
                summary.residual_energy_last_j
                / (self.config.nodes * self.config.initial_energy_j)
                for summary in summaries
            ])),
            "peak_residual": float(np.mean([
                max(energies, default=0.0) / self.config.initial_energy_j
                for energies in final_energies
            ])),
            "pdr_pct": float(np.mean([
                summary.pdr_total_pct for summary in summaries
            ])),
        }

    def _weighted_score(self, metrics: dict[str, float]) -> float:
        horizon = self.config.rounds
        weights = self.weights
        weighted_score = (
            weights.fnd * metrics["fnd"] / horizon
            + weights.r10 * metrics["r10"] / horizon
            + weights.hnd * metrics["hnd"] / horizon
            + weights.r90 * metrics["r90"] / horizon
            + weights.lnd * metrics["lnd"] / horizon
            + weights.peak_residual * metrics["peak_residual"]
            + weights.mean_residual * metrics["mean_residual"]
            + weights.pdr * metrics["pdr_pct"] / 100.0
        )
        weight_total = sum(weights.as_dict().values())
        return float(weighted_score / weight_total)

