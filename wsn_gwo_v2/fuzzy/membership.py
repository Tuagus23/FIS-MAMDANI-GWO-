from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import numpy as np

ENERGY_LABELS = ("Rendah", "Sedang", "Tinggi")
DISTANCE_LABELS = ("Dekat", "Sedang", "Jauh")
NEIGHBOR_LABELS = ("Sedikit", "Sedang", "Banyak")
OUTPUT_LABELS = ("Rendah", "Sedang", "Tinggi")


@dataclass(frozen=True)
class MembershipFunction:
    """One triangular or trapezoidal fuzzy membership function."""

    shape: str
    points: tuple[float, ...]

    def __post_init__(self) -> None:
        expected_size = {"tri": 3, "trap": 4}.get(self.shape)
        if expected_size is None or len(self.points) != expected_size:
            raise ValueError("shape must be 'tri' with 3 points or 'trap' with 4")
        if tuple(sorted(self.points)) != self.points:
            raise ValueError("membership points must be in nondecreasing order")

    def degree(self, value: float) -> float:
        """Return membership in [0, 1] for one input value."""
        return float(self.degree_array(np.asarray([value], dtype=float))[0])

    def degree_array(self, values: np.ndarray) -> np.ndarray:
        """Vectorized membership calculation for a batch of input values."""
        x = np.asarray(values, dtype=float)
        if self.shape == "tri":
            return self._triangle_degree(x)
        return self._trapezoid_degree(x)

    def _triangle_degree(self, values: np.ndarray) -> np.ndarray:
        a, b, c = self.points
        left = np.where(values < a, 0.0, 1.0) if b == a else (values - a) / (b - a)
        right = np.where(values > c, 0.0, 1.0) if c == b else (c - values) / (c - b)
        return np.clip(np.minimum(left, right), 0.0, 1.0)

    def _trapezoid_degree(self, values: np.ndarray) -> np.ndarray:
        a, b, c, d = self.points
        left = np.where(values < a, 0.0, 1.0) if b == a else (values - a) / (b - a)
        right = np.where(values > d, 0.0, 1.0) if d == c else (d - values) / (d - c)
        return np.clip(np.minimum(np.minimum(left, 1.0), right), 0.0, 1.0)

    def to_dict(self) -> dict:
        return {"shape": self.shape, "points": list(self.points)}

    @classmethod
    def from_dict(cls, data: dict) -> "MembershipFunction":
        return cls(
            shape=str(data["shape"]),
            points=tuple(float(value) for value in data["points"]),
        )


@dataclass(frozen=True)
class MembershipSet:
    """All input and output membership functions used by one fuzzy system."""

    energy: Mapping[str, MembershipFunction]
    distance: Mapping[str, MembershipFunction]
    neighbors: Mapping[str, MembershipFunction]
    output: Mapping[str, MembershipFunction]

    @classmethod
    def default(cls) -> "MembershipSet":
        """Return the expert-defined membership functions."""
        return cls(
            energy={
                "Rendah": MembershipFunction("trap", (0.0, 0.0, 0.30, 0.50)),
                "Sedang": MembershipFunction("tri", (0.30, 0.50, 0.70)),
                "Tinggi": MembershipFunction("trap", (0.50, 0.70, 1.0, 1.0)),
            },
            distance={
                "Dekat": MembershipFunction("trap", (0.0, 0.0, 20.0, 40.0)),
                "Sedang": MembershipFunction("tri", (20.0, 50.0, 80.0)),
                "Jauh": MembershipFunction("trap", (60.0, 80.0, 100.0, 100.0)),
            },
            neighbors={
                "Sedikit": MembershipFunction("trap", (0.0, 0.0, 3.0, 6.0)),
                "Sedang": MembershipFunction("tri", (3.0, 7.0, 12.0)),
                "Banyak": MembershipFunction("trap", (8.0, 12.0, 20.0, 20.0)),
            },
            output={
                "Rendah": MembershipFunction("trap", (0.0, 0.0, 0.30, 0.50)),
                "Sedang": MembershipFunction("tri", (0.30, 0.50, 0.70)),
                "Tinggi": MembershipFunction("trap", (0.50, 0.70, 1.0, 1.0)),
            },
        )

    def to_dict(self) -> dict:
        def serialize(group: Mapping[str, MembershipFunction]) -> dict:
            return {label: membership.to_dict() for label, membership in group.items()}

        return {
            "energy": serialize(self.energy),
            "distance": serialize(self.distance),
            "neighbors": serialize(self.neighbors),
            "output": serialize(self.output),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MembershipSet":
        def deserialize(group: dict) -> dict[str, MembershipFunction]:
            return {
                label: MembershipFunction.from_dict(definition)
                for label, definition in group.items()
            }

        return cls(
            energy=deserialize(data["energy"]),
            distance=deserialize(data["distance"]),
            neighbors=deserialize(data["neighbors"]),
            output=deserialize(data["output"]),
        )

    def save(self, path: str | Path) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
        return target

    @classmethod
    def load(cls, path: str | Path) -> "MembershipSet":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(data)

