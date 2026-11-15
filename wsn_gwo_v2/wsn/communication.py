from __future__ import annotations

from math import hypot

from .models import CommunicationResult, Node
from .radio import RadioEnergyModel


class ClusterCommunication:
    """Applies radio costs to members and cluster heads for one round."""

    def __init__(self, radio: RadioEnergyModel, sink_x_m: float, sink_y_m: float) -> None:
        self.radio = radio
        self.sink_x_m = sink_x_m
        self.sink_y_m = sink_y_m

    def run(
        self,
        all_nodes: list[Node],
        active_nodes: list[Node],
        heads: list[Node],
        assignments: dict[int, list[Node]],
    ) -> CommunicationResult:
        energy_before = sum(node.energy_j for node in all_nodes)
        delivered_readings = 0
        receiver_cost = self.radio.receive_and_aggregate()

        for head in heads:
            if not head.alive:
                continue
            member_readings = self._receive_members(
                head, assignments[head.node_id], receiver_cost
            )
            if not head.alive:
                continue
            if self._send_aggregate(head):
                delivered_readings += member_readings + 1

        residual_energy = sum(node.energy_j for node in all_nodes)
        return CommunicationResult(
            packets_generated=len(active_nodes),
            readings_delivered=delivered_readings,
            energy_consumed_j=max(0.0, energy_before - residual_energy),
        )

    def _receive_members(
        self,
        head: Node,
        members: list[Node],
        receiver_cost: float,
    ) -> int:
        received = 0
        for member in members:
            member_cost = self.radio.transmit(self._distance(member, head))
            if member.energy_j + 1e-15 < member_cost:
                member.energy_j = 0.0
                continue
            member.energy_j = max(0.0, member.energy_j - member_cost)
            if head.energy_j + 1e-15 < receiver_cost:
                head.energy_j = 0.0
                break
            head.energy_j = max(0.0, head.energy_j - receiver_cost)
            received += 1
        return received

    def _send_aggregate(self, head: Node) -> bool:
        distance_to_sink = hypot(
            head.x_m - self.sink_x_m,
            head.y_m - self.sink_y_m,
        )
        transmit_cost = self.radio.transmit(distance_to_sink)
        if head.energy_j + 1e-15 < transmit_cost:
            head.energy_j = 0.0
            return False
        head.energy_j = max(0.0, head.energy_j - transmit_cost)
        return True

    @staticmethod
    def _distance(first: Node, second: Node) -> float:
        return hypot(first.x_m - second.x_m, first.y_m - second.y_m)

