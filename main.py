from __future__ import annotations

import argparse
from pathlib import Path

from wsn_gwo_v2.config import OptimizerConfig, SimulationConfig
from wsn_gwo_v2.experiment import ExperimentRunner


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="WSN clustering with fuzzy inference and Grey Wolf Optimization."
    )
    parser.add_argument("--optimize", action="store_true", help="Calibrate fuzzy MFs with GWO.")
    parser.add_argument("--load-mf", type=Path, help="Load an existing membership_gwo.json.")
    parser.add_argument("--nodes", type=int, default=30)
    parser.add_argument("--rounds", type=int, default=1600)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--ch-count", type=int, default=1)
    parser.add_argument("--wolves", type=int, default=8)
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--fitness-rounds", type=int)
    parser.add_argument("--fitness-seeds", default="1,2,3,4,5,6,7,8,9,10")
    parser.add_argument("--fitness-mode", choices=("balanced", "lifetime"), default="lifetime")
    parser.add_argument("--validate-seeds", type=int, default=0)
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    _validate_args(parser, args)
    return args


def _validate_args(parser: argparse.ArgumentParser, args: argparse.Namespace) -> None:
    if args.optimize and args.load_mf:
        parser.error("choose either --optimize or --load-mf")
    if args.validate_seeds < 0:
        parser.error("--validate-seeds cannot be negative")
    if args.validate_seeds and not (args.optimize or args.load_mf):
        parser.error("--validate-seeds requires --optimize or --load-mf")


def _make_configurations(args: argparse.Namespace):
    simulation = SimulationConfig(
        nodes=args.nodes,
        rounds=args.rounds,
        seed=args.seed,
        cluster_head_count=args.ch_count,
    )
    if not args.optimize:
        return simulation, None

    fitness_rounds = args.fitness_rounds
    if fitness_rounds is None:
        fitness_rounds = simulation.rounds
    seeds = tuple(int(part.strip()) for part in args.fitness_seeds.split(",") if part.strip())
    optimizer = OptimizerConfig(
        wolves=args.wolves,
        iterations=args.iterations,
        seed=args.seed + 7,
        fitness_rounds=fitness_rounds,
        fitness_seeds=seeds,
        mode=args.fitness_mode,
    )
    return simulation, optimizer


def main() -> None:
    args = parse_args()
    simulation_config, optimizer_config = _make_configurations(args)
    runner = ExperimentRunner(
        simulation_config=simulation_config,
        output_dir=args.output_dir,
        optimizer_config=optimizer_config,
        load_membership_path=args.load_mf,
        validation_seeds=args.validate_seeds,
    )
    runner.run()


if __name__ == "__main__":
    main()

