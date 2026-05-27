/** Words ignored when splitting stored names (connectors between people). */
const NAME_CONNECTOR_WORDS = new Set(["or", "and", "&", "/"])

/**
 * Split a search string into lowercase tokens (words), dropping empties.
 */
export function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,;/]+/)
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((part) => part.length > 0)
}

/** Lowercase name with "or"/"and" turned into spaces so tokens can match across parts. */
export function normalizeNameHaystack(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(or|and)\b/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractNameWords(name: string): string[] {
  const lower = name.toLowerCase()
  const fromNormalized = normalizeNameHaystack(name)
  const combined = `${lower} ${fromNormalized}`
  return combined
    .split(/[\s,;/\-&]+/)
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((part) => part.length > 0 && !NAME_CONNECTOR_WORDS.has(part))
}

/**
 * Every query word must match the name: as a substring anywhere, or as a prefix of a name word.
 * e.g. "James John" → "JAMES OR LINDSEY JOHNSON"; "James Joh" → Johnson via prefix.
 */
export function nameMatchesSmartSearch(name: string | null | undefined, query: string): boolean {
  const raw = name?.trim() ?? ""
  const q = query.trim()
  if (!q) return true
  if (!raw) return false

  const lower = raw.toLowerCase()
  const normalized = normalizeNameHaystack(raw)

  if (lower.includes(q.toLowerCase()) || normalized.includes(q.toLowerCase())) {
    return true
  }

  const tokens = tokenizeSearchQuery(q)
  if (tokens.length === 0) return true

  const words = Array.from(new Set(extractNameWords(raw)))

  return tokens.every((token) => {
    if (lower.includes(token) || normalized.includes(token)) {
      return true
    }
    return words.some(
      (word) =>
        word.includes(token) ||
        word.startsWith(token) ||
        (token.length >= 3 && token.startsWith(word)),
    )
  })
}

/**
 * Match when the full query appears in text, or every query word appears somewhere in text.
 */
export function textMatchesSmartSearch(text: string | null | undefined, query: string): boolean {
  const haystack = text?.trim().toLowerCase() ?? ""
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (!haystack) return false
  if (haystack.includes(q)) return true

  const tokens = tokenizeSearchQuery(q)
  if (tokens.length === 0) return true
  return tokens.every((token) => haystack.includes(token))
}

export function shareholderRecordMatchesSearch(
  fields: {
    name?: string | null
    /** Other name fields (property owner, customer, etc.) */
    alternateNames?: (string | null | undefined)[]
    shareholderId?: string | null
    barcodeId?: string | null
    sharedId?: string | null
    ownerMailingAddress?: string | null
    ownerCityStateZip?: string | null
    propertyTexts?: (string | null | undefined)[]
  },
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return true

  const namesToTry = [fields.name, ...(fields.alternateNames ?? [])].filter(
    (n): n is string => Boolean(n?.trim()),
  )

  if (namesToTry.some((n) => nameMatchesSmartSearch(n, q))) {
    return true
  }

  if (textMatchesSmartSearch(fields.shareholderId, q)) return true
  if (textMatchesSmartSearch(fields.barcodeId, q)) return true
  if (textMatchesSmartSearch(fields.sharedId, q)) return true
  if (textMatchesSmartSearch(fields.ownerMailingAddress, q)) return true
  if (textMatchesSmartSearch(fields.ownerCityStateZip, q)) return true

  return (fields.propertyTexts ?? []).some((text) => textMatchesSmartSearch(text, q))
}
