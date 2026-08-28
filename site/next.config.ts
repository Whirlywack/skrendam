import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Old English collection slugs 301 → LT slugs (V2 spec §5).
  async redirects() {
    return [
      {
        source: "/cheap-flights-from-vilnius",
        destination: "/pigus-skrydziai-is-vilniaus",
        permanent: true,
      },
      {
        source: "/cheap-flights-from-kaunas",
        destination: "/pigus-skrydziai-is-kauno",
        permanent: true,
      },
      {
        source: "/cheap-flights-from-riga",
        destination: "/pigus-skrydziai-is-rygos",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
