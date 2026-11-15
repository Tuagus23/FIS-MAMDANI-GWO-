from __future__ import annotations

from math import hypot

import numpy as np

from ..config import SimulationConfig
from .models import Node, NodeFeatures


class NetworkFeatureExtractor:
    """Calculates the three fuzzy inputs for the active nodes in one round."""

    def __init__(self, config: SimulationConfig) -> None:
        self.config = config

    def extract(self, active_nodes: list[Node]) -> NodeFeatures:
        return NodeFeatures(
            energy_fraction=self._energy_fractions(active_nodes),
            sink_distance_m=self._sink_distances(active_nodes),
            neighbor_count=self._neighbor_counts(active_nodes),
        )

    def _energy_fractions(self, nodes: list[Node]) -> np.ndarray:
        return np.asarray(
            [node.energy_j / self.config.initial_energy_j for node in nodes],
            dtype=float,
        )

    def _sink_distances(self, nodes: list[Node]) -> np.ndarray:
        return np.asarray([
            min(
                hypot(node.x_m - self.config.sink_x_m, node.y_m - self.config.sink_y_m),
                100.0,
            )
            for node in nodes
        ], dtype=float)

    def _neighbor_counts(self, nodes: list[Node]) -> np.ndarray:
        coordinates = np.asarray([[node.x_m, node.y_m] for node in nodes], dtype=float)
        differences = coordinates[:, None, :] - coordinates[None, :, :]
        distances = np.hypot(differences[:, :, 0], differences[:, :, 1])
        neighbor_mask = distances <= self.config.neighbor_radius_m
        np.fill_diagonal(neighbor_mask, False)
        return np.minimum(np.sum(neighbor_mask, axis=1), 20).astype(float)

