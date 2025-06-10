import { neon } from "@neondatabase/serverless"

// Ensure this file is only used in server contexts
if (typeof window !== "undefined") {
    throw new Error("This module can only be used server-side")
}

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
}

// Initialize Neon serverless SQL connection
export const sql = neon(process.env.DATABASE_URL)

// Helper function to execute SQL queries
export async function query<T extends Record<string, any>>(sqlQuery: string, params: any[] = []): Promise<T[]> {
    try {
        const results = await sql(sqlQuery, params)
        return results as T[]
    } catch (error) {
        console.error('Database query error:', error)
        throw error
    }
}

// Helper function to execute a single row query
export async function queryOne<T extends Record<string, any>>(sqlQuery: string, params: any[] = []): Promise<T | null> {
    const results = await query<T>(sqlQuery, params)
    return results[0] || null
}
