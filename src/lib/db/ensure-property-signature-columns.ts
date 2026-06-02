import { neon } from "@neondatabase/serverless"

const g = globalThis as typeof globalThis & {
  __ensurePropertySignatureColumns?: Promise<void>
}

/** Add per-property signature columns (idempotent). One ALTER per Neon call. */
export function ensurePropertySignatureColumns(): Promise<void> {
  if (typeof window !== "undefined") return Promise.resolve()
  const url = process.env.DATABASE_URL
  if (!url) return Promise.resolve()

  if (!g.__ensurePropertySignatureColumns) {
    const sql = neon(url)
    g.__ensurePropertySignatureColumns = (async () => {
      await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS signature_image TEXT`
      await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS signature_hash TEXT`
      await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP`
    })().catch((err: unknown) => {
      g.__ensurePropertySignatureColumns = undefined
      throw err
    })
  }

  return g.__ensurePropertySignatureColumns
}
