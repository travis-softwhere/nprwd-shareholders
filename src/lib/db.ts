import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { logToFile, LogLevel } from "@/utils/logger"

// Ensure this file is only used in server contexts
if (typeof window !== "undefined") {
    throw new Error("This module can only be used server-side")
}

if (!process.env.DATABASE_URL) {
    logToFile("database", "DATABASE_URL environment variable is not set", LogLevel.ERROR)
    throw new Error("DATABASE_URL environment variable is not set")
}

// Initialize Neon serverless SQL connection
const sql = neon(process.env.DATABASE_URL)

// Create Drizzle instance with Neon HTTP driver
export const db = drizzle(sql)

// Log successful initialization
logToFile("database", "Database connection initialized successfully", LogLevel.INFO)