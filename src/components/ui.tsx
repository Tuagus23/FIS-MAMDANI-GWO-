"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Protocol } from "@/lib/types";
export interface Column<T> {
  label: ReactNode;
  render: (row: T) => ReactNode;
  align?: "start" | "end";
  wrap?: boolean;
}
export function DataTable<T>({
  rows,
  columns,
  label = "Tabel data",
}: {
  rows: T[];
  columns: Column<T>[];
  label?: string;
}) {
  if (!rows.length)
    return <p className="table-footnote">Tidak ada data untuk ditampilkan.</p>;
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label={label}
      data-lenis-prevent
    >
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                data-align={column.align ?? (i === 0 ? "start" : "end")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((column, j) => (
                <td
                  key={j}
                  data-align={column.align ?? (j === 0 ? "start" : "end")}
                  data-wrap={column.wrap || undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Panel({
  title,
  caption,
  action,
  children,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const hover = useSyncExternalStore(subscribeHover, hoverEnabled, () => false);
  return (
    <motion.article
      className="panel min-w-0"
      whileHover={hover ? { borderColor: "#b5c8bd" } : undefined}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="panel-heading">
        <h2 className="panel-title">{title}</h2>
        {action}
      </div>
      {caption && <p className="panel-caption">{caption}</p>}
      {children}
    </motion.article>
  );
}
const hoverQuery =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
function hoverEnabled() {
  return matchMedia(hoverQuery).matches;
}
function subscribeHover(callback: () => void) {
  const query = matchMedia(hoverQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
export function ProtocolName({ name }: { name: Protocol }) {
  return (
    <span className="protocol-name">
      <span
        className={`protocol-symbol ${name.toLowerCase()}`}
        aria-hidden="true"
      />
      {name}
    </span>
  );
}
export function DataDetails({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={`chart-data-details ${className}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open && <div className="details-content">{children}</div>}
    </details>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
