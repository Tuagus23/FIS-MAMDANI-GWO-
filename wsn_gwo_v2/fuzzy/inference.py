from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from .membership import (
    DISTANCE_LABELS,
    ENERGY_LABELS,
    NEIGHBOR_LABELS,
    OUTPUT_LABELS,
    MembershipSet,
)
from .rules import FuzzyRuleBase


class FuzzyInferenceSystem(ABC):
    """Shared fuzzification and rule-strength calculation for an FIS."""

    def __init__(
        self,
        membership: MembershipSet | None = None,
        rule_base: FuzzyRuleBase | None = None,
    ) -> None:
        self.membership = membership or MembershipSet.default()
        self.rule_base = rule_base or FuzzyRuleBase.standard()
        self._rule_indices = self._build_rule_indices()

    def _build_rule_indices(self) -> tuple[np.ndarray, ...]:
        rules = self.rule_base.rules
        energy_indices = np.array([ENERGY_LABELS.index(rule.energy) for rule in rules])
        distance_indices = np.array([DISTANCE_LABELS.index(rule.distance) for rule in rules])
        neighbor_indices = np.array([NEIGHBOR_LABELS.index(rule.neighbors) for rule in rules])
        output_indices = np.array([OUTPUT_LABELS.index(rule.output) for rule in rules])
        return energy_indices, distance_indices, neighbor_indices, output_indices

    def _membership_matrix(
        self,
        values: np.ndarray,
        functions: dict,
        labels: tuple[str, ...],
    ) -> np.ndarray:
        return np.column_stack([
            functions[label].degree_array(values)
            for label in labels
        ])

    def _rule_strengths(self, energy, distance, neighbors) -> np.ndarray:
        energy, distance, neighbors = np.broadcast_arrays(
            np.atleast_1d(np.asarray(energy, dtype=float)),
            np.atleast_1d(np.asarray(distance, dtype=float)),
            np.atleast_1d(np.asarray(neighbors, dtype=float)),
        )
        energy_mu = self._membership_matrix(
            energy, self.membership.energy, ENERGY_LABELS
        )
        distance_mu = self._membership_matrix(
            distance, self.membership.distance, DISTANCE_LABELS
        )
        neighbor_mu = self._membership_matrix(
            neighbors, self.membership.neighbors, NEIGHBOR_LABELS
        )
        energy_index, distance_index, neighbor_index, _ = self._rule_indices
        return np.minimum(
            np.minimum(energy_mu[:, energy_index], distance_mu[:, distance_index]),
            neighbor_mu[:, neighbor_index],
        )

    def _output_activations(self, strengths: np.ndarray) -> np.ndarray:
        _, _, _, output_indices = self._rule_indices
        activations = np.zeros((strengths.shape[0], len(OUTPUT_LABELS)))
        for index in range(len(OUTPUT_LABELS)):
            activations[:, index] = strengths[:, output_indices == index].max(axis=1)
        return activations

    def infer_one(self, energy: float, distance: float, neighbors: float) -> float:
        return float(self.infer_batch([energy], [distance], [neighbors])[0])

    @abstractmethod
    def infer_batch(self, energy, distance, neighbors) -> np.ndarray:
        """Return one crisp CH score for each row of input values."""


class MamdaniFIS(FuzzyInferenceSystem):
    """Mamdani min/max inference with centroid defuzzification."""

    def __init__(
        self,
        membership: MembershipSet | None = None,
        rule_base: FuzzyRuleBase | None = None,
        output_points: int = 501,
    ) -> None:
        super().__init__(membership, rule_base)
        if output_points < 2:
            raise ValueError("output_points must be at least 2")
        self.output_x = np.linspace(0.0, 1.0, output_points)
        self._output_curves = np.vstack([
            self.membership.output[label].degree_array(self.output_x)
            for label in OUTPUT_LABELS
        ])

    def infer_batch(self, energy, distance, neighbors) -> np.ndarray:
        strengths = self._rule_strengths(energy, distance, neighbors)
        activations = self._output_activations(strengths)
        aggregate = np.zeros((strengths.shape[0], self.output_x.size))

        for output_index in range(len(OUTPUT_LABELS)):
            clipped_curve = np.minimum(
                activations[:, output_index, None],
                self._output_curves[output_index][None, :],
            )
            np.maximum(aggregate, clipped_curve, out=aggregate)

        dx = np.diff(self.output_x)
        area = np.sum(
            (aggregate[:, :-1] + aggregate[:, 1:]) * (dx[None, :] / 2.0),
            axis=1,
        )
        moment_curve = aggregate * self.output_x[None, :]
        moment = np.sum(
            (moment_curve[:, :-1] + moment_curve[:, 1:]) * (dx[None, :] / 2.0),
            axis=1,
        )
        return np.divide(
            moment, area, out=np.full_like(moment, 0.5), where=area > 1e-15
        )

