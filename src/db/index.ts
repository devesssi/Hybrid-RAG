import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 1. Define the connection string blueprint
const connectionString = "postgresql://postgres:mysecretpassword@localhost:5432/verbamind";

// 2. Create a low-level network connection client
const queryClient = postgres(connectionString);

// 3. Initialize Drizzle as our high-level ORM management layer
export const db = drizzle(queryClient, { schema });