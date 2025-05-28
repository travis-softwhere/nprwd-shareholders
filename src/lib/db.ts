import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { pgTable, text, varchar } from "drizzle-orm/pg-core"

// Ensure this file is only used in server contexts
if (typeof window !== "undefined") {
    throw new Error("This module can only be used server-side")
}

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
}

// Define the shareholder table schema
export const shareholders = pgTable("shareholders", {
    shareholderId: varchar("shareholder_id").primaryKey(),
    designee: text("designee"),
});

// Initialize Neon serverless SQL connection
const sql = neon(process.env.DATABASE_URL)

// Create Drizzle instance with Neon HTTP driver
export const db = drizzle(sql, { schema: { shareholders } })

