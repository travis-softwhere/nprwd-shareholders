/** Words ignored when splitting a stored name into matchable parts (not removed from the search query). */
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

/**
 * Match when the full query appears in text, or every query word appears somewhere in text.
 * e.g. "James Johnson" matches "James or Lindsay Johnson".
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

/**
 * True if every query token matches at least one "name part" from the stored name,
 * where parts are split on spaces and connectors like "or" / "and".
 */
export function nameMatchesSmartSearch(name: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const raw = name?.trim().toLowerCase() ?? ""
  if (!raw) return false
  if (raw.includes(q)) return true

  const queryTokens = tokenizeSearchQuery(q)
  if (queryTokens.length === 0) return true

  const nameParts = raw
    .split(/[\s,;/]+/)
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((part) => part.length > 0 && !NAME_CONNECTOR_WORDS.has(part))

  if (nameParts.length === 0) return textMatchesSmartSearch(raw, q)

  return queryTokens.every((token) =>
    nameParts.some((part) => part.includes(token) || token.includes(part)),
  )
}

export function shareholderRecordMatchesSearch(
  fields: {
    name?: string | null
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

  if (nameMatchesSmartSearch(fields.name, q)) return true
  if (textMatchesSmartSearch(fields.shareholderId, q)) return true
  if (textMatchesSmartSearch(fields.barcodeId, q)) return true
  if (textMatchesSmartSearch(fields.sharedId, q)) return true
  if (textMatchesSmartSearch(fields.ownerMailingAddress, q)) return true
  if (textMatchesSmartSearch(fields.ownerCityStateZip, q)) return true

  return (fields.propertyTexts ?? []).some((text) => textMatchesSmartSearch(text, q))
}
