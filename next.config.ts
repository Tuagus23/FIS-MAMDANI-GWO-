import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/login.html", destination: "/login", permanent: true }];
  },
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: `${process.env.DASHBOARD_API_ORIGIN || "http://127.0.0.1:8000"}/api/:path*`,
          },
        ]
      : [];
  },
};
export default nextConfig;
