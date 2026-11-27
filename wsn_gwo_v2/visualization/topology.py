from __future__ import annotations

import csv
from pathlib import Path

from ..config import SimulationConfig
from ..wsn.topology import topology_data


def save_topology_images(config: SimulationConfig, seeds, output_dir: str | Path) -> list[Path]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import patheffects
    from matplotlib.font_manager import FontProperties
    from matplotlib.transforms import Bbox

    output = Path(output_dir) / "topologies"
    output.mkdir(parents=True, exist_ok=True)
    paths = []
    for seed in dict.fromkeys(seeds):
        layout = topology_data(config, seed)
        nodes = layout["nodes"]
        station = layout["base_station"]
        fig, axes = plt.subplots(figsize=(8, 8), constrained_layout=True)
        axes.scatter([n["x_m"] for n in nodes], [n["y_m"] for n in nodes],
                     s=38, color="#167565", label="Node sensor", zorder=3)
        axes.scatter([station["x_m"]], [station["y_m"]], marker="s",
                     s=110, color="#ae4b15", label="BS (Base Station)", zorder=4)
        axes.set(xlim=(min(0, station["x_m"]) - 4, max(config.width_m, station["x_m"]) + 4),
                 ylim=(min(0, station["y_m"]) - 4, max(config.height_m, station["y_m"]) + 4),
                 xlabel="Posisi X (meter)", ylabel="Posisi Y (meter)",
                 title=f"Posisi awal node dan BS | Seed {seed}")
        axes.set_aspect("equal", adjustable="box")
        axes.grid(alpha=0.18)
        axes.legend(loc="upper center", bbox_to_anchor=(0.5, -0.09), ncol=2)
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        items = [("BS", station["x_m"], station["y_m"])]
        items.extend((str(n["node_id"]), n["x_m"], n["y_m"]) for n in nodes)
        occupied = []
        marker_boxes = [
            Bbox.from_bounds(px - 6, py - 6, 12, 12)
            for px, py in axes.transData.transform([(x, y) for _, x, y in items])
        ]
        for label, x, y in items:
            px, py = axes.transData.transform((x, y))
            width, height, _ = renderer.get_text_width_height_descent(label, FontProperties(size=11), False)
            candidates = [(dx, dy) for radius in (10, 22, 36, 50)
                          for dx, dy in ((radius, radius), (-radius-width, radius),
                                         (radius, -radius-height), (-radius-width, -radius-height))]
            boxes = [Bbox.from_bounds(px+dx-2, py+dy-2, width+4, height+6) for dx, dy in candidates]
            scores = [
                sum(box.overlaps(other) for other in [*occupied, *marker_boxes])
                + 100 * (not axes.bbox.contains(box.x0, box.y0) or not axes.bbox.contains(box.x1, box.y1))
                for box in boxes
            ]
            chosen = min(range(len(candidates)), key=lambda i: (scores[i], i))
            occupied.append(boxes[chosen])
            dx, dy = candidates[chosen]
            annotation = axes.annotate(
                label, (x, y), xytext=(dx * 72 / fig.dpi, dy * 72 / fig.dpi), textcoords="offset points",
                fontsize=11, ha="left", va="bottom", color="#173e35",
                arrowprops={"arrowstyle": "-", "color": "#8eaaa0", "lw": 0.6},
                zorder=5,
            )
            annotation.set_path_effects([patheffects.withStroke(linewidth=2.5, foreground="white")])
        image_path = output / f"seed_{seed}.png"
        fig.savefig(image_path, dpi=170)
        plt.close(fig)
        coordinates = [{"label": f"Node {n['node_id']}", "x_m": n["x_m"], "y_m": n["y_m"]} for n in nodes]
        coordinates.append({"label": "BS", **station})
        with (output / f"seed_{seed}.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=("label", "x_m", "y_m"))
            writer.writeheader()
            writer.writerows(coordinates)
        paths.append(image_path)
    return paths
