from __future__ import annotations

from ..config import SimulationConfig
from ..fuzzy import MembershipSet
from .communication import ClusterCommunication
from .features import NetworkFeatureExtractor
from .metrics import SimulationMetrics
from .models import Node, RoundMetrics, SimulationSummary
from .network import NetworkState
from .radio import RadioEnergyModel
from .selectors import SelectorFactory
from .topology import create_topology


class NetworkSimulator:
    """Coordinates feature extraction, CH selection, communication, and metrics."""

    _PROTOCOL_SEED_OFFSET = {
        "FUZZY": 0,
        "LEACH": 1000,
        "GWO": 2000,
    }

    def __init__(
        self,
        config: SimulationConfig,
        protocol: str,
        initial_nodes: list[Node] | None = None,
        membership: MembershipSet | None = None,
    ) -> None:
        self.config = config
        self.protocol = protocol.upper()
        if initial_nodes is None:
            initial_nodes = create_topology(config, config.seed)
        if len(initial_nodes) != config.nodes:
            raise ValueError("initial_nodes length must match config.nodes")
        node_ids = [node.node_id for node in initial_nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("node IDs must be unique")

        self.network = NetworkState(initial_nodes)
        self.feature_extractor = NetworkFeatureExtractor(config)
        self.radio = RadioEnergyModel(config)
        self.selector = SelectorFactory.create(
            protocol=self.protocol,
            config=config,
            node_ids=node_ids,
            random_seed=config.seed + self._PROTOCOL_SEED_OFFSET.get(self.protocol, 0),
            membership=membership,
        )
        self.communication = ClusterCommunication(
            self.radio, config.sink_x_m, config.sink_y_m
        )
        self.metrics = SimulationMetrics(config, self.protocol)

    @property
    def nodes(self) -> list[Node]:
        return self.network.nodes

    @property
    def history(self) -> list[RoundMetrics]:
        return self.metrics.history

    def run(self) -> list[RoundMetrics]:
        for round_number in range(1, self.config.rounds + 1):
            active_nodes = self.network.active_nodes()
            if not active_nodes:
                break

            features = self.feature_extractor.extract(active_nodes)
            heads = self.selector.select(active_nodes, features, round_number)
            assignments = self.network.assign_members(heads)
            communication_result = self.communication.run(
                self.network.nodes, active_nodes, heads, assignments
            )
            self.metrics.record(
                round_number,
                communication_result,
                self.network.nodes,
                len(heads),
            )
        return self.history

    def summary(self) -> SimulationSummary:
        return self.metrics.summary(self.network.nodes)

