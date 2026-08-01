import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Initializes only when an API route actually needs the database. This keeps
 * `next build` and deployment previews independent of production secrets.
 */
export function getDb() {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and configure it.");
  }

  const queryClient = postgres(connectionString);
  database = drizzle(queryClient, { schema });
  return database;
}
