from __future__ import annotations

from ..config import SimulationConfig


class RadioEnergyModel:
    """First-order radio model for transmitting, receiving, and aggregation."""

    def __init__(self, config: SimulationConfig) -> None:
        self.config = config

    def transmit(self, distance_m: float) -> float:
        bits = self.config.packet_bits
        electronics = bits * self.config.electronics_j_per_bit
        amplifier = bits * self.config.amplifier_j_per_bit_m2 * distance_m**2
        return electronics + amplifier

    def receive_and_aggregate(self) -> float:
        bits = self.config.packet_bits
        receive = bits * self.config.electronics_j_per_bit
        aggregate = bits * self.config.aggregation_j_per_bit
        return receive + aggregate

