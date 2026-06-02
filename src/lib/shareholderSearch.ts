import {
  canonicalShareholderId,
  displayShareholderId,
  shareholderIdLookupCandidates,
} from "@/lib/meetingScopedShareholderId"

/** Words ignored when splitting stored names (connectors between people). */
const NAME_CONNECTOR_WORDS = new Set(["or", "and", "&", "/"])

export type ShareholderSearchFields = {
  name?: string | null
  /** Other name fields (property owner, customer, etc.) */
  alternateNames?: (string | null | undefined)[]
  shareholderId?: string | null
  barcodeId?: string | null
  sharedId?: string | null
  meetingId?: string | null
  ownerMailingAddress?: string | null
  ownerCityStateZip?: string | null
  propertyTexts?: (string | null | undefined)[]
}

function idSearchCandidates(value: string, meetingId?: string | null): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const set = new Set<string>([trimmed.toLowerCase()])
  if (meetingId) {
    for (const candidate of shareholderIdLookupCandidates(trimmed, meetingId)) {
      set.add(candidate.toLowerCase())
    }
    set.add(canonicalShareholderId(trimmed, meetingId).toLowerCase())
    set.add(displayShareholderId(trimmed, meetingId).toLowerCase())
  }
  return Array.from(set)
}

/**
 * True when the query matches a stored shareholder / barcode / shared id (exact, including meeting-scoped forms).
 */
export function shareholderIdMatchesQuery(
  fields: Pick<
    ShareholderSearchFields,
    "shareholderId" | "barcodeId" | "sharedId" | "meetingId"
  >,
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return false

  const queryCandidates = idSearchCandidates(q, fields.meetingId)
  const storedValues = [fields.shareholderId, fields.barcodeId, fields.sharedId].filter(
    (value): value is string => Boolean(value?.trim()),
  )

  for (const stored of storedValues) {
    const storedCandidates = idSearchCandidates(stored, fields.meetingId)
    for (const queryCandidate of queryCandidates) {
      for (const storedCandidate of storedCandidates) {
        if (queryCandidate === storedCandidate) return true
      }
    }
  }

  return false
}

/** True when the user is likely searching by barcode / numeric id (not a person name). */
export function queryLooksLikeShareholderId(query: string): boolean {
  const q = query.trim()
  if (!q) return false
  if (/^\d+$/.test(q)) return true
  // meetingId-numericSuffix (e.g. 3-123456)
  if (/^\d+-\d+$/.test(q)) return true
  return false
}

/**
 * When the query matches any benefit unit owner id, return only those rows (not name/address/property matches).
 * ID-only narrowing applies for numeric / barcode-style queries so name searches are not suppressed.
 */
export function filterShareholdersBySearchTerm<T>(
  items: T[],
  query: string,
  getFields: (item: T) => ShareholderSearchFields,
): T[] {
  const q = query.trim()
  if (!q) return items

  const exactIdMatches = items.filter((item) => shareholderIdMatchesQuery(getFields(item), q))
  if (exactIdMatches.length > 0 && queryLooksLikeShareholderId(q)) {
    return exactIdMatches
  }

  return items.filter((item) => shareholderRecordMatchesSearch(getFields(item), q))
}

/** Owner, customer, and resident names from property rows (deduped, trimmed). */
export function collectPropertyNames(
  properties:
    | Array<{
        ownerName?: string | null
        customerName?: string | null
        residentName?: string | null
      }>
    | undefined
    | null,
): string[] {
  if (!properties?.length) return []
  const seen = new Set<string>()
  const names: string[] = []
  for (const property of properties) {
    for (const value of [property.ownerName, property.customerName, property.residentName]) {
      const trimmed = value?.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      names.push(trimmed)
    }
  }
  return names
}

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

function nameFieldMatchesToken(name: string, token: string): boolean {
  const lower = name.toLowerCase()
  const normalized = normalizeNameHaystack(name)
  if (lower.includes(token) || normalized.includes(token)) {
    return true
  }
  const words = extractNameWords(name)
  return words.some(
    (word) =>
      word.includes(token) ||
      word.startsWith(token) ||
      (token.length >= 3 && token.startsWith(word)),
  )
}

/**
 * Match benefit unit owner name and all property name fields (owner, customer, resident).
 * Supports multi-word queries across different fields (e.g. first name on one line, last on another).
 */
export function shareholderNamesMatchSearch(
  names: (string | null | undefined)[],
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return true

  const nonEmpty = names.filter((name): name is string => Boolean(name?.trim()))
  if (nonEmpty.length === 0) return false

  if (nonEmpty.some((name) => nameMatchesSmartSearch(name, q))) {
    return true
  }

  const tokens = tokenizeSearchQuery(q)
  if (tokens.length === 0) return true

  return tokens.every((token) => nonEmpty.some((name) => nameFieldMatchesToken(name, token)))
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
  fields: ShareholderSearchFields,
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return true

  if (shareholderIdMatchesQuery(fields, q)) {
    return true
  }

  const allNames = [fields.name, ...(fields.alternateNames ?? [])]

  if (shareholderNamesMatchSearch(allNames, q)) {
    return true
  }

  if (textMatchesSmartSearch(fields.ownerMailingAddress, q)) return true
  if (textMatchesSmartSearch(fields.ownerCityStateZip, q)) return true

  return (fields.propertyTexts ?? []).some((text) => textMatchesSmartSearch(text, q))
}
