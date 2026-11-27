from __future__ import annotations

import numpy as np

from ..config import SimulationConfig
from .models import Node


class TopologyFactory:
    """Creates repeatable node layouts from an experiment seed."""

    @staticmethod
    def random(config: SimulationConfig, seed: int) -> list[Node]:
        rng = np.random.default_rng(seed)
        return [
            Node(
                node_id=index + 1,
                x_m=float(rng.uniform(0.0, config.width_m)),
                y_m=float(rng.uniform(0.0, config.height_m)),
                energy_j=config.initial_energy_j,
            )
            for index in range(config.nodes)
        ]


def create_topology(config: SimulationConfig, seed: int) -> list[Node]:
    """Convenience wrapper retained for a simple public API."""
    return TopologyFactory.random(config, seed)


def topology_data(config: SimulationConfig, seed: int) -> dict:
    return {
        "seed": seed,
        "width_m": config.width_m,
        "height_m": config.height_m,
        "base_station": {"x_m": config.sink_x_m, "y_m": config.sink_y_m},
        "nodes": [
            {"node_id": node.node_id, "x_m": node.x_m, "y_m": node.y_m}
            for node in create_topology(config, seed)
        ],
    }

