import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle commands.");
}

export default defineConfig({
  // Where our TypeScript blueprint schemas live
  schema: "./src/db/schema.ts",
  
  // Where we want Drizzle to generate the raw SQL history files
  out: "./src/db/migrations",
  
  // The database dialect we are targeting
  dialect: "postgresql",
  
  // Let Drizzle Kit know how to talk directly to our local container
  dbCredentials: {
    url: databaseUrl,
  },
});
