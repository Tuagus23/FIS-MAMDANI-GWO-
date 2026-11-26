from __future__ import annotations

from dataclasses import dataclass


NEIGHBOR_INPUT_CAP = 20


@dataclass(frozen=True)
class SimulationConfig:
    nodes: int = 30
    width_m: float = 100.0
    height_m: float = 100.0
    sink_x_m: float = 50.0
    sink_y_m: float = 50.0
    initial_energy_j: float = 1.0
    rounds: int = 1600
    neighbor_radius_m: float = 25.0
    cluster_head_count: int = 1
    packet_bits: int = 4000
    electronics_j_per_bit: float = 50e-9
    amplifier_j_per_bit_m2: float = 100e-12
    aggregation_j_per_bit: float = 10e-9
    leach_probability: float = 0.10
    seed: int = 42
    fuzzy_output_points: int = 501

    def __post_init__(self) -> None:
        if self.nodes < 2:
            raise ValueError("nodes must be at least 2")
        if min(self.width_m, self.height_m, self.initial_energy_j) <= 0:
            raise ValueError("area dimensions and initial energy must be positive")
        if self.rounds < 1 or self.packet_bits < 1:
            raise ValueError("rounds and packet_bits must be positive")
        if not 1 <= self.cluster_head_count <= self.nodes:
            raise ValueError("cluster_head_count must be between 1 and nodes")
        if not 0.0 < self.leach_probability <= 1.0:
            raise ValueError("leach_probability must be in (0, 1]")
        if self.fuzzy_output_points < 51:
            raise ValueError("fuzzy_output_points must be at least 51")


@dataclass(frozen=True)
class OptimizerConfig:
    wolves: int = 8
    iterations: int = 10
    seed: int = 7
    fitness_rounds: int = 1600
    fitness_seeds: tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    mode: str = "lifetime"

    def __post_init__(self) -> None:
        if self.wolves < 3:
            raise ValueError("GWO needs at least three wolves")
        if self.iterations < 1 or self.fitness_rounds < 1:
            raise ValueError("iterations and fitness_rounds must be positive")
        if not self.fitness_seeds:
            raise ValueError("fitness_seeds cannot be empty")
        if self.mode not in {"balanced", "lifetime"}:
            raise ValueError("mode must be 'balanced' or 'lifetime'")

