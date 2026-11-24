import type { Membership, MembershipSpec, Summary, View } from "./types";

export const views: Record<View, { title: string; description: string }> = {
  hasil: {
    title: "Ringkasan",
    description:
      "Bandingkan umur jaringan dan keberhasilan pengiriman tiga protokol.",
  },
  validasi: {
    title: "Validasi model",
    description:
      "Membandingkan model FUZZY dan GWO pada seed uji yang terpisah dari seed kalibrasi.",
  },
  membership: {
    title: "Fungsi keanggotaan",
    description:
      "Melihat cara energi, jarak, dan jumlah tetangga diterjemahkan menjadi skor kandidat cluster head.",
  },
  gwo: {
    title: "Proses GWO",
    description:
      "Telusuri cara Grey Wolf Optimizer menyetel titik fungsi keanggotaan dan memilih solusi terbaik.",
  },
  fis: {
    title: "Proses FIS Mamdani",
    description:
      "Ikuti perubahan energi, jarak, dan jumlah tetangga menjadi skor kandidat cluster head.",
  },
  anggota: {
    title: "Anggota kelompok",
    description:
      "Kenali tim dan peran setiap anggota dalam pengembangan proyek Fuzzy CH WSN.",
  },
  motto: {
    title: "Motto kelompok",
    description:
      "Pegangan Kelompok 3 dalam menjalani proses belajar dan mengembangkan proyek.",
  },
  simulasi: {
    title: "Simulasi baru",
    description:
      "Ubah parameter jaringan dan lihat perbandingan tiga protokol pada topologi yang sama.",
  },
};
export const viewPath = (view: View) => (view === "hasil" ? "/" : `/${view}`);
export const protocols = ["FUZZY", "LEACH", "GWO"] as const;
export const colors = { FUZZY: "#00765e", LEACH: "#3568a8", GWO: "#b34d16" };
export const shapes = {
  FUZZY: "circle",
  LEACH: "rect",
  GWO: "triangle",
} as const;
export const initialColors = ["#075985", "#9F1239", "#6D28D9"];
export const optimizedColors = ["#0F766E", "#C2410C", "#166534"];
const integerFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const integer = (value: number | null | undefined) =>
  value == null ? "—" : integerFormat.format(value);
export const decimal = (value: number | null | undefined) =>
  value == null ? "—" : decimalFormat.format(value);
export const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${decimal(value)}%`;
export const milestone = (value: number | null | undefined, horizon: number) =>
  value == null ? `> ${integer(horizon)} (belum tercapai)` : integer(value);
export function bestRows(
  rows: Summary[],
  key: "fnd" | "hnd" | "lnd" | "pdr_total_pct",
) {
  const eligible = rows.filter(
    (row) => row[key] !== null || key !== "pdr_total_pct",
  );
  const score = (row: Summary) => row[key] ?? Infinity;
  const max = Math.max(...eligible.map(score));
  return eligible.filter((row) => score(row) === max);
}
export function degree(spec: MembershipSpec, x: number): number {
  const [a, b, c, d] = spec.points;
  const left = a === b ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const right =
    spec.shape === "tri"
      ? b === c
        ? x <= c
          ? 1
          : 0
        : (c - x) / (c - b)
      : d === c
        ? x <= d
          ? 1
          : 0
        : (d - x) / (d - c);
  return Math.max(0, Math.min(1, left, right));
}
export function membershipRows(membership: Membership) {
  return Object.entries(membership).flatMap(([variable, group]) =>
    Object.entries(group).map(([label, spec]) => ({
      variable,
      label,
      shape: spec.shape === "tri" ? "Segitiga" : "Trapesium",
      points: spec.points.map(decimal).join(", "),
    })),
  );
}
export function errorMessage(
  error: unknown,
  fallback = "Permintaan gagal. Coba lagi sebentar.",
) {
  return error instanceof Error ? error.message : fallback;
}
