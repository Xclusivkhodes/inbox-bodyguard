import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // cacheComponents left the page in a postponed shell. Client components
  // rendered, then never hydrated, so every button was dead.
  // Dev HMR is a cross-origin request when the browser uses 127.0.0.1 and
  // the server reports localhost. Without this, the client runtime never
  // hydrates and every button stays dead.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["imapflow", "mailparser"],
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: "/api/:path*" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
