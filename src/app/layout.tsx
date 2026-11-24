import type { Metadata } from "next";
import "./globals.css";
import "lenis/dist/lenis.css";
export const metadata: Metadata = {
  title: { default: "Fuzzy CH WSN", template: "%s · Fuzzy CH WSN" },
  description:
    "Dashboard eksperimen pemilihan cluster head dengan FIS Mamdani dan GWO.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-mist font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
