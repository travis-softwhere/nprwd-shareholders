/**
 * Runs once per Node server instance (including many Vercel cold starts).
 * Best-effort: add missing DB columns. Must not throw — a transient Neon/network error
 * during boot would otherwise fail the entire instrumentation hook and break requests.
 * Routes still call `ensureShareholdersSharedIdColumn()` before querying.
 */
export async function register() {
    // Skip Edge; Node serverless may omit NEXT_RUNTIME — still run ensure there.
    if (process.env.NEXT_RUNTIME === "edge") return
    try {
        const { ensureShareholdersSharedIdColumn } = await import("@/lib/db/ensure-shareholders-shared-id")
        await ensureShareholdersSharedIdColumn()
    } catch (e) {
        console.warn(
            "[instrumentation] ensure shareholders.shared_id skipped (will retry on first API use):",
            e instanceof Error ? e.message : e,
        )
    }
}
