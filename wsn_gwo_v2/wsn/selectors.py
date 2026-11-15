from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from ..config import SimulationConfig
from ..fuzzy import MamdaniFIS, MembershipSet
from .models import Node, NodeFeatures


class ClusterHeadSelector(ABC):
    """Strategy interface shared by all cluster-head selection methods."""

    @abstractmethod
    def select(
        self,
        active_nodes: list[Node],
        features: NodeFeatures,
        round_number: int,
    ) -> list[Node]:
        raise NotImplementedError


class ScoreBasedSelector(ClusterHeadSelector):
    """Selects a configured number of highest-scoring active sensor nodes."""

    def __init__(self, cluster_head_count: int) -> None:
        self.cluster_head_count = cluster_head_count

    def _select_top_scores(self, nodes: list[Node], scores: np.ndarray) -> list[Node]:
        count = min(self.cluster_head_count, len(nodes))
        order = np.argsort(-scores, kind="stable")
        return [nodes[int(index)] for index in order[:count]]


class MamdaniCHSelector(ScoreBasedSelector):
    """Shared CH selection behavior for manual and GWO-calibrated Mamdani FIS."""

    def __init__(
        self,
        cluster_head_count: int,
        membership: MembershipSet,
        output_points: int,
    ) -> None:
        super().__init__(cluster_head_count)
        self.inference = MamdaniFIS(
            membership=membership,
            output_points=output_points,
        )

    def select(self, active_nodes, features, round_number) -> list[Node]:
        scores = self.inference.infer_batch(
            features.energy_fraction,
            features.sink_distance_m,
            features.neighbor_count,
        )
        return self._select_top_scores(active_nodes, scores)


class FuzzyCHSelector(MamdaniCHSelector):
    """Manual Mamdani selector using the default expert membership functions."""

    def __init__(self, cluster_head_count: int, output_points: int) -> None:
        super().__init__(
            cluster_head_count,
            membership=MembershipSet.default(),
            output_points=output_points,
        )


class GWOCHSelector(MamdaniCHSelector):
    """Mamdani selector using membership functions calibrated offline by GWO."""

    def __init__(
        self,
        cluster_head_count: int,
        membership: MembershipSet,
        output_points: int,
    ) -> None:
        super().__init__(cluster_head_count, membership, output_points)


class LeachCHSelector(ClusterHeadSelector):
    """LEACH threshold selector with an epoch-based CH rotation rule."""

    def __init__(
        self,
        probability: float,
        node_ids: list[int],
        random_seed: int,
    ) -> None:
        self.probability = probability
        self.epoch_length = max(1, int(round(1.0 / probability)))
        self.last_selected_round = {node_id: -10**9 for node_id in node_ids}
        self.rng = np.random.default_rng(random_seed)

    def _threshold(self, round_number: int) -> float:
        position = (round_number - 1) % self.epoch_length
        denominator = 1.0 - self.probability * position
        return min(1.0, self.probability / max(1e-12, denominator))

    def select(self, active_nodes, features, round_number) -> list[Node]:
        eligible = [
            node for node in active_nodes
            if round_number - self.last_selected_round[node.node_id] >= self.epoch_length
        ]
        threshold = self._threshold(round_number)
        heads = [node for node in eligible if self.rng.random() < threshold]
        if not heads:
            heads = [max(eligible or active_nodes, key=lambda node: node.energy_j)]
        for head in heads:
            self.last_selected_round[head.node_id] = round_number
        return heads


class SelectorFactory:
    """Constructs a selector and its inference system from a protocol name."""

    @staticmethod
    def create(
        protocol: str,
        config: SimulationConfig,
        node_ids: list[int],
        random_seed: int,
        membership: MembershipSet | None = None,
    ) -> ClusterHeadSelector:
        name = protocol.upper()
        mf_set = membership or MembershipSet.default()
        if name == "FUZZY":
            return FuzzyCHSelector(config.cluster_head_count, config.fuzzy_output_points)
        if name == "GWO":
            return GWOCHSelector(
                config.cluster_head_count,
                mf_set,
                config.fuzzy_output_points,
            )
        if name == "LEACH":
            return LeachCHSelector(config.leach_probability, node_ids, random_seed)
        raise ValueError(f"unsupported protocol: {protocol}")

