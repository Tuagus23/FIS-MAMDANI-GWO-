from __future__ import annotations

import numpy as np

from .membership import (
    DISTANCE_LABELS,
    ENERGY_LABELS,
    NEIGHBOR_LABELS,
    MembershipFunction,
    MembershipSet,
)


class MFEncoder:
    """Maps GWO coordinates to valid input MFs without changing their shapes."""

    _VARIABLES = (
        (
            "energy", 0.0, 1.0, ENERGY_LABELS,
            ((0.10, 0.45), (0.40, 0.65), (0.60, 0.92)), 0.08,
        ),
        (
            "distance", 0.0, 100.0, DISTANCE_LABELS,
            ((0.10, 0.35), (0.25, 0.50), (0.40, 0.65), (0.50, 0.75), (0.65, 0.92)), 0.04,
        ),
        (
            "neighbors", 0.0, 20.0, NEIGHBOR_LABELS,
            ((0.10, 0.30), (0.20, 0.40), (0.30, 0.50), (0.35, 0.55), (0.50, 0.85)), 0.02,
        ),
    )

    @property
    def dimension(self) -> int:
        return sum(len(variable[4]) for variable in self._VARIABLES)

    def decode(self, vector: np.ndarray) -> MembershipSet:
        coordinates = np.asarray(vector, dtype=float).reshape(-1)
        if coordinates.size != self.dimension:
            raise ValueError(
                f"expected {self.dimension} search coordinates, got {coordinates.size}"
            )
        if not np.all(np.isfinite(coordinates)):
            raise ValueError("GWO coordinates must be finite")
        coordinates = np.clip(coordinates, 0.0, 1.0)

        groups = {}
        offset = 0
        for name, low, high, labels, bands, minimum_gap in self._VARIABLES:
            count = len(bands)
            thresholds = self._decode_thresholds(
                coordinates[offset:offset + count],
                low,
                high,
                bands,
                minimum_gap,
            )
            groups[name] = self._create_input_functions(
                labels, low, high, thresholds
            )
            offset += count

        return MembershipSet(
            energy=groups["energy"],
            distance=groups["distance"],
            neighbors=groups["neighbors"],
            output=MembershipSet.default().output,
        )

    @staticmethod
    def _decode_thresholds(
        coordinates: np.ndarray,
        low: float,
        high: float,
        bands: tuple[tuple[float, float], ...],
        minimum_gap_fraction: float,
    ) -> tuple[float, ...]:
        span = high - low
        raw = [
            low + span * (band_low + (band_high - band_low) * coordinate)
            for coordinate, (band_low, band_high) in zip(coordinates, bands)
        ]
        minimum_gap = span * minimum_gap_fraction
        thresholds = []
        for index, value in enumerate(raw):
            lower = thresholds[-1] + minimum_gap if thresholds else low
            remaining = len(raw) - index - 1
            upper = high - remaining * minimum_gap
            thresholds.append(min(max(value, lower), upper))
        return tuple(thresholds)

    @staticmethod
    def _create_input_functions(
        labels: tuple[str, str, str],
        low: float,
        high: float,
        thresholds: tuple[float, ...],
    ) -> dict[str, MembershipFunction]:
        low_label, middle_label, high_label = labels
        if len(thresholds) == 3:
            first, middle_peak, last = thresholds
            return {
                low_label: MembershipFunction("trap", (low, low, first, middle_peak)),
                middle_label: MembershipFunction("tri", (first, middle_peak, last)),
                high_label: MembershipFunction("trap", (middle_peak, last, high, high)),
            }

        first, low_end, middle_peak, high_start, last = thresholds
        return {
            low_label: MembershipFunction("trap", (low, low, first, low_end)),
            middle_label: MembershipFunction("tri", (first, middle_peak, last)),
            high_label: MembershipFunction("trap", (high_start, last, high, high)),
        }

    def reference_vector(self) -> np.ndarray:
        """Encode the exact expert curves as the GWO starting point."""
        expert = MembershipSet.default()
        vector = []
        for name, low, high, labels, bands, _minimum_gap in self._VARIABLES:
            functions = getattr(expert, name)
            low_mf = functions[labels[0]].points
            middle_mf = functions[labels[1]].points
            high_mf = functions[labels[2]].points
            if len(bands) == 3:
                thresholds = (low_mf[2], middle_mf[1], middle_mf[2])
            else:
                thresholds = (
                    low_mf[2], low_mf[3], middle_mf[1],
                    high_mf[0], middle_mf[2],
                )
            span = high - low
            vector.extend(
                float(np.clip(
                    ((value - low) / span - band_low) / (band_high - band_low),
                    0.0,
                    1.0,
                ))
                for value, (band_low, band_high) in zip(thresholds, bands)
            )
        return np.asarray(vector, dtype=float)

