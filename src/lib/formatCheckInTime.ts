/** NPRWD meeting operations (North Dakota) — Central Time. */
export const NPRWD_CHECK_IN_TIME_ZONE = "America/Chicago"

/**
 * Postgres `timestamp without time zone` values from the server are UTC clock times.
 * Parse them as UTC so browser local display matches Central via {@link formatCheckInDateTime}.
 */
export function parseStoredTimestamp(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const s = String(value).trim()
  if (!s) return null

  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const normalized = s.includes("T") ? s : s.replace(" ", "T")
  const asUtc = normalized.endsWith("Z") ? normalized : `${normalized}Z`
  const d = new Date(asUtc)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatCheckInDateTime(value: Date | string | null | undefined): string {
  const d = parseStoredTimestamp(value)
  if (!d) return ""

  return new Intl.DateTimeFormat("en-US", {
    timeZone: NPRWD_CHECK_IN_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}
