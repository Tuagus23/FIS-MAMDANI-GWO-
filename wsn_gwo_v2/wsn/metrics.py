from __future__ import annotations

from math import ceil
from typing import Callable

from ..config import SimulationConfig
from .models import CommunicationResult, Node, RoundMetrics, SimulationSummary


class SimulationMetrics:
    """Collects per-round metrics and derives network lifetime milestones."""

    def __init__(self, config: SimulationConfig, protocol: str) -> None:
        self.config = config
        self.protocol = protocol
        self.history: list[RoundMetrics] = []
        self.total_generated = 0
        self.total_delivered = 0

    def record(
        self,
        round_number: int,
        communication: CommunicationResult,
        nodes: list[Node],
        cluster_head_count: int,
    ) -> RoundMetrics:
        self.total_generated += communication.packets_generated
        self.total_delivered += communication.readings_delivered
        alive = sum(node.alive for node in nodes)
        generated_this_round = communication.packets_generated
        delivered_this_round = communication.readings_delivered
        row = RoundMetrics(
            protocol=self.protocol,
            round_number=round_number,
            alive_nodes=alive,
            dead_nodes=self.config.nodes - alive,
            energy_consumed_j=communication.energy_consumed_j,
            residual_energy_j=sum(node.energy_j for node in nodes),
            packets_generated=generated_this_round,
            readings_delivered=delivered_this_round,
            pdr_round_pct=100.0 * delivered_this_round / generated_this_round
            if generated_this_round else 0.0,
            pdr_total_pct=100.0 * self.total_delivered / self.total_generated
            if self.total_generated else 0.0,
            cluster_heads=cluster_head_count,
        )
        self.history.append(row)
        return row

    def summary(self, nodes: list[Node]) -> SimulationSummary:
        if not self.history:
            return SimulationSummary(
                protocol=self.protocol,
                last_round=0,
                fnd=None,
                r10=None,
                hnd=None,
                r90=None,
                lnd=None,
                alive_nodes_last=sum(node.alive for node in nodes),
                residual_energy_last_j=sum(node.energy_j for node in nodes),
                total_packets_generated=0,
                total_readings_delivered=0,
                pdr_total_pct=0.0,
            )

        last = self.history[-1]
        return SimulationSummary(
            protocol=self.protocol,
            last_round=last.round_number,
            fnd=self._first_round(lambda row: row.dead_nodes > 0),
            r10=self._milestone(0.10),
            hnd=self._milestone(0.50),
            r90=self._milestone(0.90),
            lnd=self._milestone(1.00),
            alive_nodes_last=last.alive_nodes,
            residual_energy_last_j=last.residual_energy_j,
            total_packets_generated=self.total_generated,
            total_readings_delivered=self.total_delivered,
            pdr_total_pct=last.pdr_total_pct,
        )

    def _milestone(self, fraction_dead: float) -> int | None:
        target = max(1, ceil(fraction_dead * self.config.nodes))
        return self._first_round(lambda row: row.dead_nodes >= target)

    def _first_round(self, condition: Callable[[RoundMetrics], bool]) -> int | None:
        return next(
            (row.round_number for row in self.history if condition(row)),
            None,
        )

