import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les migrations SQL (db/migrations/*.sql) sont lues à l'exécution par le
  // diagnostic, la route /api/system/migrate et la page Paramètres. On les
  // inclut dans le bundle serverless (Vercel) pour qu'elles soient présentes.
  outputFileTracingIncludes: {
    "/api/system/migrate": ["./db/migrations/**/*"],
    "/api/system/diagnostic": ["./db/migrations/**/*"],
    "/settings": ["./db/migrations/**/*"],
    "/api/shopify/oauth-config": ["./db/migrations/**/*"],
  },
};

export default nextConfig;
