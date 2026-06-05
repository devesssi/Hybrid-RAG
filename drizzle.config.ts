import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Where our TypeScript blueprint schemas live
  schema: "./src/db/schema.ts",
  
  // Where we want Drizzle to generate the raw SQL history files
  out: "./src/db/migrations",
  
  // The database dialect we are targeting
  dialect: "postgresql",
  
  // Let Drizzle Kit know how to talk directly to our local container
  dbCredentials: {
    url: "postgresql://postgres:mysecretpassword@localhost:5432/verbamind",
  },
}); 