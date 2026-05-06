/**
 * One-shot: add shareholders.shared_id for Neon / Postgres.
 * Run: npx ts-node scripts/migrate-shared-id.ts
 * Requires DATABASE_URL (e.g. load .env in shell or use Neon SQL Editor with other/migrations/0003_shareholders_shared_id.sql).
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { neon } from "@neondatabase/serverless"

function loadDotEnv() {
    const p = join(process.cwd(), ".env")
    if (!existsSync(p)) return
    const raw = readFileSync(p, "utf8")
    for (const line of raw.split("\n")) {
        const t = line.trim()
        if (!t || t.startsWith("#")) continue
        const eq = t.indexOf("=")
        if (eq <= 0) continue
        const key = t.slice(0, eq).trim()
        let val = t.slice(eq + 1).trim()
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = val
    }
}

async function main() {
    loadDotEnv()
    const url = process.env.DATABASE_URL
    if (!url) {
        console.error("DATABASE_URL is not set.")
        process.exit(1)
    }
    const sql = neon(url)
    await sql`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS shared_id TEXT`
    await sql`
        COMMENT ON COLUMN shareholders.shared_id IS
        'Optional CSV merge key: rows sharing this value import as one shareholder. Canonical mailing uses owners columns on this row (first row of group); property rows keep per-line owner_* for lookup.'
    `
    console.log("OK: shareholders.shared_id is ready.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
