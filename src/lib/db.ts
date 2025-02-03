import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

// Remove the deprecated option
// neonConfig.fetchConnectionCache = true

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
}

// Ensure this file is only used in server contexts
if (typeof window !== "undefined") {
    throw new Error("This module can only be used server-side")
}

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql)