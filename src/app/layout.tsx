import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "lenis/dist/lenis.css";
export const metadata: Metadata = {
  title: { default: "Fuzzy CH WSN", template: "%s · Fuzzy CH WSN" },
  description:
    "Dashboard eksperimen pemilihan cluster head dengan FIS Mamdani dan GWO.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const config =
    url && publishableKey?.startsWith("sb_publishable_")
      ? JSON.stringify({ url, publishableKey }).replace(/</g, "\\u003c")
      : null;
  return (
    <html lang="id">
      <body className="min-h-screen bg-mist font-sans text-ink antialiased">
        {config && (
          <script
            id="dashboard-auth-config"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: config }}
          />
        )}
        {children}
      </body>
    </html>
  );
}
