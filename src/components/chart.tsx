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
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let chart: import("chart.js").Chart | undefined;
    import("chart.js/auto")
      .then(({ default: ChartJs }) => {
        if (!disposed && ref.current) chart = new ChartJs(ref.current, config);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      chart?.destroy();
    };
  }, [config]);
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
