import csv
import tempfile
import unittest
from pathlib import Path

from app import dashboard_data
from wsn_gwo_v2.config import SimulationConfig
from wsn_gwo_v2.wsn.topology import create_topology, topology_data
from wsn_gwo_v2.visualization.topology import save_topology_images


class TopologyTests(unittest.TestCase):
    def test_positions_ids_and_station_match_simulator_configuration(self):
        config = SimulationConfig(width_m=140, height_m=90, sink_x_m=75, sink_y_m=45)
        result = topology_data(config, 42)
        self.assertEqual(result["base_station"], {"x_m": 75, "y_m": 45})
        self.assertEqual([node["node_id"] for node in result["nodes"]], list(range(1, 31)))
        for actual, node in zip(result["nodes"], create_topology(config, 42)):
            self.assertEqual((actual["x_m"], actual["y_m"]), (node.x_m, node.y_m))
        self.assertEqual(result, topology_data(config, 42))
        self.assertNotEqual(result["nodes"], topology_data(config, 143)["nodes"])

    def test_dataset_seeds_are_grouped_without_optimizer_seed(self):
        calibrated = dashboard_data("hasil_optimasi_10seed")["topologies"]
        self.assertEqual(calibrated["fitness_seeds"], list(range(1, 11)))
        self.assertEqual(calibrated["experiment_seed"], 42)
        self.assertEqual(calibrated["validation_seeds"], [143 + 101 * i for i in range(10)])
        self.assertEqual(len(calibrated["layouts"]), 21)
        self.assertNotIn(49, [layout["seed"] for layout in calibrated["layouts"]])
        single = dashboard_data("optimasi_seed42_weight030")["topologies"]
        self.assertEqual(single["fitness_seeds"], [42])
        self.assertEqual(len(single["layouts"]), 11)
        self.assertEqual(
            next(layout for layout in calibrated["layouts"] if layout["seed"] == 42),
            next(layout for layout in single["layouts"] if layout["seed"] == 42),
        )

    def test_export_has_exactly_thirty_labeled_nodes_and_bs(self):
        with tempfile.TemporaryDirectory() as temporary:
            paths = save_topology_images(SimulationConfig(), [42, 143, 42], temporary)
            self.assertEqual(len(paths), 2)
            self.assertTrue(all(path.read_bytes().startswith(b"\x89PNG") for path in paths))
            with (Path(temporary) / "topologies/seed_42.csv").open() as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual([row["label"] for row in rows], [f"Node {i}" for i in range(1, 31)] + ["BS"])
            self.assertEqual((rows[-1]["x_m"], rows[-1]["y_m"]), ("50.0", "50.0"))


if __name__ == "__main__":
    unittest.main()
