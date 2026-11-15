from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

import numpy as np


@dataclass
class GWOResult:
    """Best solution and convergence data from one optimizer run."""

    best_position: np.ndarray
    best_fitness: float
    history: list[dict[str, float]] = field(default_factory=list)
    evaluations: int = 0
    elapsed_seconds: float = 0.0
    wolves: int = 0
    iterations: int = 0
    population_history: list[dict[str, object]] = field(default_factory=list)


class GreyWolfOptimizer:
    """Bounded, synchronous Grey Wolf Optimizer for continuous objectives."""

    def __init__(
        self,
        objective: Callable[[np.ndarray], float],
        dimension: int,
        wolves: int = 8,
        iterations: int = 10,
        lower: float = 0.0,
        upper: float = 1.0,
        seed: int = 7,
        maximize: bool = True,
        warm_start: np.ndarray | None = None,
    ) -> None:
        self._validate_parameters(dimension, wolves, iterations, lower, upper)
        self.objective = objective
        self.dimension = int(dimension)
        self.wolves = int(wolves)
        self.iterations = int(iterations)
        self.lower = float(lower)
        self.upper = float(upper)
        self.seed = int(seed)
        self.maximize = bool(maximize)
        self.warm_start = self._normalize_warm_start(warm_start)

    @staticmethod
    def _validate_parameters(
        dimension: int,
        wolves: int,
        iterations: int,
        lower: float,
        upper: float,
    ) -> None:
        if dimension < 1:
            raise ValueError("dimension must be positive")
        if wolves < 3:
            raise ValueError("GWO needs at least three wolves")
        if iterations < 1:
            raise ValueError("iterations must be positive")
        if upper <= lower:
            raise ValueError("upper must be greater than lower")

    def _normalize_warm_start(self, point: np.ndarray | None) -> np.ndarray | None:
        if point is None:
            return None
        normalized = np.asarray(point, dtype=float).reshape(-1)
        if normalized.size != self.dimension:
            raise ValueError("warm_start has the wrong dimension")
        if not np.all(np.isfinite(normalized)):
            raise ValueError("warm_start must contain finite coordinates")
        return np.clip(normalized, self.lower, self.upper)

    def _rank(self, fitness_values: np.ndarray) -> np.ndarray:
        rank_key = -fitness_values if self.maximize else fitness_values
        return np.argsort(rank_key, kind="stable")

    def _evaluate(self, position: np.ndarray) -> float:
        value = float(self.objective(position.copy()))
        if np.isfinite(value):
            return value
        return -np.inf if self.maximize else np.inf

    def _evaluate_population(self, positions: np.ndarray) -> np.ndarray:
        return np.asarray(
            [self._evaluate(position) for position in positions],
            dtype=float,
        )

    def _next_position(
        self,
        wolf: np.ndarray,
        leaders: np.ndarray,
        convergence_factor: float,
        rng: np.random.Generator,
    ) -> np.ndarray:
        proposals = []
        for leader in leaders:
            r1 = rng.random(self.dimension)
            r2 = rng.random(self.dimension)
            coefficient_a = convergence_factor * (2.0 * r1 - 1.0)
            coefficient_c = 2.0 * r2
            distance = np.abs(coefficient_c * leader - wolf)
            proposals.append(leader - coefficient_a * distance)
        return np.clip(np.mean(proposals, axis=0), self.lower, self.upper)

    def _convergence_factor(self, iteration: int) -> float:
        return 2.0 - 2.0 * iteration / max(1, self.iterations - 1)

    def optimize(self) -> GWOResult:
        rng = np.random.default_rng(self.seed)
        started_at = time.perf_counter()
        positions = rng.uniform(
            self.lower, self.upper, size=(self.wolves, self.dimension)
        )
        if self.warm_start is not None:
            positions[0] = self.warm_start

        fitness_values = self._evaluate_population(positions)
        evaluations = self.wolves
        leaders = self._top_leaders(positions, fitness_values)
        best_position = leaders[0].copy()
        best_fitness = float(fitness_values[self._rank(fitness_values)[0]])
        history = [self._history_row(0, best_fitness, fitness_values)]
        population_history = self._population_rows(0, positions, fitness_values)

        for iteration in range(self.iterations):
            convergence_factor = self._convergence_factor(iteration)
            positions = self._move_population(
                positions, leaders, convergence_factor, rng
            )
            fitness_values = self._evaluate_population(positions)
            evaluations += self.wolves

            leaders = self._top_leaders(positions, fitness_values)
            current_best_index = self._rank(fitness_values)[0]
            current_best = float(fitness_values[current_best_index])
            if self._is_better(current_best, best_fitness):
                best_position = positions[current_best_index].copy()
                best_fitness = current_best
            history.append(self._history_row(iteration + 1, best_fitness, fitness_values))
            population_history.extend(
                self._population_rows(iteration + 1, positions, fitness_values)
            )

        return GWOResult(
            best_position=best_position,
            best_fitness=best_fitness,
            history=history,
            evaluations=evaluations,
            elapsed_seconds=time.perf_counter() - started_at,
            wolves=self.wolves,
            iterations=self.iterations,
            population_history=population_history,
        )

    def _population_rows(
        self,
        iteration: int,
        positions: np.ndarray,
        fitness_values: np.ndarray,
    ) -> list[dict[str, object]]:
        order = self._rank(fitness_values)
        ranks = np.empty(self.wolves, dtype=int)
        ranks[order] = np.arange(1, self.wolves + 1)
        roles = {index: role for index, role in zip(order[:3], ("alpha", "beta", "delta"))}
        return [
            {
                "iteration": iteration,
                "wolf": wolf_index + 1,
                "rank": int(ranks[wolf_index]),
                "role": roles.get(wolf_index, "wolf"),
                "fitness": float(fitness_values[wolf_index]),
                "position": positions[wolf_index].copy(),
            }
            for wolf_index in range(self.wolves)
        ]

    def _top_leaders(
        self,
        positions: np.ndarray,
        fitness_values: np.ndarray,
    ) -> np.ndarray:
        order = self._rank(fitness_values)
        return positions[order[:3]].copy()

    def _move_population(
        self,
        positions: np.ndarray,
        leaders: np.ndarray,
        convergence_factor: float,
        rng: np.random.Generator,
    ) -> np.ndarray:
        old_positions = positions.copy()
        return np.asarray([
            self._next_position(wolf, leaders, convergence_factor, rng)
            for wolf in old_positions
        ])

    def _is_better(self, candidate: float, incumbent: float) -> bool:
        return candidate > incumbent if self.maximize else candidate < incumbent

    @staticmethod
    def _history_row(
        iteration: int,
        best_fitness: float,
        population_fitness: np.ndarray,
    ) -> dict[str, float]:
        return {
            "iteration": iteration,
            "best_fitness": best_fitness,
            "mean_fitness": float(np.mean(population_fitness)),
        }

