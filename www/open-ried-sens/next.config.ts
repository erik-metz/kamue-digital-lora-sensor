import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{
      key: "Content-Security-Policy",
      // Network boundary for browser data and automatically loaded imagery.
      value: "connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'",
    }] }];
  },
};
export default nextConfig;
