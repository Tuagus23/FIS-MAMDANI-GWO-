from __future__ import annotations

from math import hypot

from .models import Node


class NetworkState:
    """Owns node state and cluster assignment for a single simulation run."""

    def __init__(self, initial_nodes: list[Node]) -> None:
        self.nodes = [
            Node(node.node_id, node.x_m, node.y_m, node.energy_j)
            for node in initial_nodes
        ]

    def active_nodes(self) -> list[Node]:
        return [node for node in self.nodes if node.alive]

    def assign_members(self, heads: list[Node]) -> dict[int, list[Node]]:
        if not heads:
            raise ValueError("at least one cluster head is required")
        assignments = {head.node_id: [] for head in heads}
        head_ids = set(assignments)
        for node in self.active_nodes():
            if node.node_id in head_ids:
                continue
            closest_head = min(heads, key=lambda head: self.distance(node, head))
            assignments[closest_head.node_id].append(node)
        return assignments

    @staticmethod
    def distance(first: Node, second: Node) -> float:
        return hypot(first.x_m - second.x_m, first.y_m - second.y_m)

