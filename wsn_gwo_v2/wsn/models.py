from __future__ import annotations

from dataclasses import dataclass

from numpy.typing import NDArray


@dataclass
class Node:
    """One sensor and its mutable residual-energy state."""

    node_id: int
    x_m: float
    y_m: float
    energy_j: float

    @property
    def alive(self) -> bool:
        return self.energy_j > 1e-15


@dataclass(frozen=True)
class NodeFeatures:
    """Fuzzy inputs aligned by index with the active node collection."""

    energy_fraction: NDArray
    sink_distance_m: NDArray
    neighbor_count: NDArray


@dataclass(frozen=True)
class CommunicationResult:
    packets_generated: int
    readings_delivered: int
    energy_consumed_j: float


@dataclass(frozen=True)
class RoundMetrics:
    protocol: str
    round_number: int
    alive_nodes: int
    dead_nodes: int
    energy_consumed_j: float
    residual_energy_j: float
    packets_generated: int
    readings_delivered: int
    pdr_round_pct: float
    pdr_total_pct: float
    cluster_heads: int


@dataclass(frozen=True)
class SimulationSummary:
    protocol: str
    last_round: int
    fnd: int | None
    r10: int | None
    hnd: int | None
    r90: int | None
    lnd: int | None
    alive_nodes_last: int
    residual_energy_last_j: float
    total_packets_generated: int
    total_readings_delivered: int
    pdr_total_pct: float

