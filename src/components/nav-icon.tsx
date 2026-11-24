import type { View } from "@/lib/types";
export function NavIcon({ view }: { view: View }) {
  const paths: Record<View, string> = {
    hasil: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z",
    validasi: "M10 2 17 5v5c0 4-4 7-7 8-3-1-7-4-7-8V5zM6 10l3 3 5-6",
    membership: "M2 16c3 0 3-12 7-12s3 12 7 12 2-4 2-4",
    gwo: "M4 5h12M4 5l6 11 6-11M2 3h4v4H2zM14 3h4v4h-4zM8 14h4v4H8z",
    fis: "M2 2h5v5H2zM13 2h5v5h-5zM7 13h6v5H7zM4 7v3h12V7M10 10v3",
    anggota:
      "M7 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 17c0-6 10-6 10 0M14 3c4 0 4 6 0 6M14 12c3 0 4 3 4 5",
    motto:
      "M3 5h5v5c0 3-2 5-5 5v-2c2 0 3-1 3-3H3zM12 5h5v5c0 3-2 5-5 5v-2c2 0 3-1 3-3h-3z",
    simulasi: "M7 5l8 5-8 5zM10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16",
  };
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[view]} />
    </svg>
  );
}
