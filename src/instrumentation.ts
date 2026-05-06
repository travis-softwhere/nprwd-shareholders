/**
 * Runs once per Node server instance (including many Vercel cold starts).
 * Ensures additive DB columns exist before Drizzle selects reference them.
 */
export async function register() {
    // Skip Edge; Node serverless may omit NEXT_RUNTIME — still run ensure there.
    if (process.env.NEXT_RUNTIME === "edge") return
    const { ensureShareholdersSharedIdColumn } = await import("@/lib/db/ensure-shareholders-shared-id")
    await ensureShareholdersSharedIdColumn()
}
