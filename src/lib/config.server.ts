import process from "node:process";

// Server-only config. Never import this file in client components.
//
// Always read process.env INSIDE a function or handler — never at module
// scope — so values are resolved per-request in serverless environments.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}
