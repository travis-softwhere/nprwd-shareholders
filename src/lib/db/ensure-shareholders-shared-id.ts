import { neon } from "@neondatabase/serverless"

const g = globalThis as typeof globalThis & {
    __ensureShareholdersSharedId?: Promise<void>
}

/**
 * Drizzle selects `shareholders.shared_id`; Neon must have the column. Safe to call repeatedly:
 * `ADD COLUMN IF NOT EXISTS` is idempotent and cheap after the first run.
 */
export function ensureShareholdersSharedIdColumn(): Promise<void> {
    if (typeof window !== "undefined") return Promise.resolve()
    const url = process.env.DATABASE_URL
    if (!url) return Promise.resolve()

    if (!g.__ensureShareholdersSharedId) {
        const sql = neon(url)
        g.__ensureShareholdersSharedId = sql`
            ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS shared_id TEXT
        `.then(() => undefined)
    }
    return g.__ensureShareholdersSharedId
}
