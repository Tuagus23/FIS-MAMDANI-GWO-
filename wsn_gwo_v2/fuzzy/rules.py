from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FuzzyRule:
    energy: str
    distance: str
    neighbors: str
    output: str


class FuzzyRuleBase:
    """Owns the 27 Mamdani rules used for cluster-head scoring."""

    _OUTPUT_TABLE = {
        "Rendah": (
            ("Rendah", "Sedang", "Sedang"),
            ("Rendah", "Rendah", "Sedang"),
            ("Rendah", "Rendah", "Rendah"),
        ),
        "Sedang": (
            ("Sedang", "Sedang", "Tinggi"),
            ("Sedang", "Sedang", "Sedang"),
            ("Rendah", "Sedang", "Sedang"),
        ),
        "Tinggi": (
            ("Tinggi", "Tinggi", "Tinggi"),
            ("Sedang", "Tinggi", "Tinggi"),
            ("Sedang", "Sedang", "Tinggi"),
        ),
    }
    ENERGY_LABELS = ("Rendah", "Sedang", "Tinggi")
    DISTANCE_LABELS = ("Dekat", "Sedang", "Jauh")
    NEIGHBOR_LABELS = ("Sedikit", "Sedang", "Banyak")
    RULE_DISTANCE_ORDER = ("Jauh", "Sedang", "Dekat")

    def __init__(self, rules: tuple[FuzzyRule, ...] | None = None) -> None:
        self.rules = rules or self._build_default_rules()
        if len(self.rules) != 27:
            raise ValueError("this rule base must contain 27 rules")

    @classmethod
    def standard(cls) -> "FuzzyRuleBase":
        return cls()

    @classmethod
    def _build_default_rules(cls) -> tuple[FuzzyRule, ...]:
        return tuple(
            FuzzyRule(
                energy=energy,
                distance=distance,
                neighbors=neighbors,
                output=cls._OUTPUT_TABLE[energy][
                    cls.DISTANCE_LABELS.index(distance)
                ][neighbor_index],
            )
            for energy in cls.ENERGY_LABELS
            for distance in cls.RULE_DISTANCE_ORDER
            for neighbor_index, neighbors in enumerate(cls.NEIGHBOR_LABELS)
        )

