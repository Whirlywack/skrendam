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
      // 2026-09-12 hygiene: English content slugs → LT. Moment-collection
      // slugs follow LT search demand (DataForSEO, Lithuania, 2026-09) — see
      // docs/plans/2026-09-12-site-page-inventory.md §7 for the numbers.
      { source: "/collections", destination: "/rinkiniai", permanent: true },
      { source: "/past-deals", destination: "/buvo", permanent: true },
      { source: "/september-sun-deals", destination: "/kur-keliauti-rugsejo-menesi", permanent: true },
      { source: "/christmas-market-flights", destination: "/kaledines-muges-europoje", permanent: true },
      { source: "/cyprus-flight-deals-from-lithuania", destination: "/pigus-skrydziai-i-kipra", permanent: true },
    ];
  },
};

export default nextConfig;
