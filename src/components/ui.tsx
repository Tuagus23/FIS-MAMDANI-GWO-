"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Protocol } from "@/lib/types";
export interface Column<T> {
  label: ReactNode;
  render: (row: T) => ReactNode;
}
export function DataTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) {
  if (!rows.length)
    return <p className="table-footnote">Tidak ada data untuk ditampilkan.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column, i) => (
              <th key={i} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((column, j) => (
                <td key={j}>{column.render(row)}</td>
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
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="chart-data-details"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open && children}
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
