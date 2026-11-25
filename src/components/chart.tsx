"use client";
import { useEffect, useRef, useState } from "react";
import type { ChartConfiguration } from "chart.js";
export function Chart({
  config,
  label,
  compact = false,
}: {
  config: ChartConfiguration;
  label: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const instance = useRef<import("chart.js").Chart | undefined>(undefined);
  const chartType = useRef(config.type);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    import("chart.js/auto")
      .then(({ default: ChartJs }) => {
        if (!disposed && ref.current) {
          ChartJs.defaults.font.family = 'Manrope, "Segoe UI", sans-serif';
          ChartJs.defaults.font.size = 13;
          if (instance.current && chartType.current === config.type) {
            instance.current.data = config.data;
            instance.current.options = config.options || {};
            instance.current.update("none");
          } else {
            instance.current?.destroy();
            instance.current = new ChartJs(ref.current, config);
            chartType.current = config.type;
          }
        }
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [config]);
  useEffect(
    () => () => {
      instance.current?.destroy();
      instance.current = undefined;
    },
    [],
  );
  return (
    <>
      {error && (
        <p role="status">
          Grafik tidak dapat dimuat. Gunakan tabel data di bawah.
        </p>
      )}
      <div
        className={
          compact ? "membership-chart" : "chart-frame chart-frame-tall"
        }
      >
        <canvas ref={ref} role="img" aria-label={label} />
      </div>
    </>
  );
}
