import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents left the page in a postponed shell. Client components
  // rendered, then never hydrated, so every button was dead.
  // Dev HMR is a cross-origin request when the browser uses 127.0.0.1 and
  // the server reports localhost. Without this, the client runtime never
  // hydrates and every button stays dead.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["imapflow", "mailparser"],
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
