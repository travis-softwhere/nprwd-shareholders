/**
 * Benefit-unit-owner CSV import: normalize arbitrary header labels to canonical field keys
 * used by `POST /api/upload` and property/shareholder inserts.
 */

/** Canonical keys — every normalized header should resolve to one of these or an unused snake_case name. */
export const BENEFIT_UNIT_OWNER_CANONICAL_FIELDS = new Set([
    "account",
    "num_of",
    "customer_name",
    "customer_mailing_address",
    "city_state_zip",
    "owner_name",
    "owner_mailing_address",
    "owner_city_state_zip",
    "mailer_id",
    "resident_name",
    "resident_mailing_address",
    "resident_city_state_zip",
    "service_address",
    "shared_id",
])

/**
 * Header row for the downloadable template (human-friendly labels).
 * Order matches common spreadsheets: core columns first, optional customer/resident block, `mailer_id` last.
 */
export const BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS: readonly string[] = [
    "account",
    "# of",
    "owner_name",
    "owner_mailing_address",
    "owner_city_state_zip",
    "service_address",
    "customer_name",
    "customer_mailing_address",
    "city_state_zip",
    "resident_name",
    "resident_mailing_address",
    "resident_city_state_zip",
    "mailer_id",
    "shared_id",
]

/** Column groups for sparse export (omit blocks when all values empty). */
export const BENEFIT_UNIT_OWNER_CORE_TEMPLATE_HEADERS: readonly string[] =
    BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS.slice(0, 6)
export const BENEFIT_UNIT_OWNER_CUSTOMER_TEMPLATE_HEADERS: readonly string[] =
    BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS.slice(6, 9)
export const BENEFIT_UNIT_OWNER_RESIDENT_TEMPLATE_HEADERS: readonly string[] =
    BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS.slice(9, 12)
export const BENEFIT_UNIT_OWNER_MAILER_TEMPLATE_HEADER: string =
    BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS[12] ?? "mailer_id"
export const BENEFIT_UNIT_OWNER_SHARED_ID_TEMPLATE_HEADER: string =
    BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS[13] ?? "shared_id"

/**
 * Group key for CSV import: when `shared_id` is set, all rows with the same value share one benefit unit owner
 * (first row’s owner name and mailing fields win on `shareholders`). Otherwise same as mailing + mailer dedupe.
 */
export function formatBenefitUnitOwnerGroupKey(record: Record<string, unknown>): string {
    const raw = String(record["shared_id"] ?? "").trim()
    if (raw.length > 0) {
        return `shared:${raw.toUpperCase()}`
    }
    return formatBenefitUnitOwnerDedupeKey({
        ownerMailingAddress: record["owner_mailing_address"] as string | undefined,
        ownerCityStateZip: record["owner_city_state_zip"] as string | undefined,
        mailerId: record["mailer_id"] as string | undefined,
    })
}

/**
 * Same composite string used to group CSV rows into one benefit unit owner on import:
 * `upper(trim(owner_mailing_address))|upper(trim(owner_city_state_zip))|upper(trim(mailer_id))`.
 * Export can write this shape into the `mailer_id` column (mailing fields from DB; CSV mailer token not stored).
 */
export function formatBenefitUnitOwnerDedupeKey(parts: {
    ownerMailingAddress?: string | null
    ownerCityStateZip?: string | null
    mailerId?: string | null
}): string {
    const m = (parts.ownerMailingAddress ?? "").trim().toUpperCase()
    const z = (parts.ownerCityStateZip ?? "").trim().toUpperCase()
    const id = (parts.mailerId ?? "").trim().toUpperCase()
    return `${m}|${z}|${id}`
}

const ALIAS_MAP: Record<string, string> = {
    account: "account",
    num_of: "num_of",
    "# of": "num_of",
    "#of": "num_of",
    number_of: "num_of",
    "number of": "num_of",
    customer_name: "customer_name",
    customer_mailing_address: "customer_mailing_address",
    city_state_zip: "city_state_zip",
    owner_name: "owner_name",
    owner_mailing_address: "owner_mailing_address",
    owner_city_state_zip: "owner_city_state_zip",
    mailer_id: "mailer_id",
    mailder_id: "mailer_id",
    resident_name: "resident_name",
    resident_mailing_address: "resident_mailing_address",
    resident_city_state_zip: "resident_city_state_zip",
    service_address: "service_address",
    shared_id: "shared_id",
    sharedid: "shared_id",
}

function toSnakeCase(raw: string): string {
    return raw
        .trim()
        .replace(/['"]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

/**
 * Map a CSV header cell (from the uploaded file’s first row) to a canonical record key.
 * Unknown columns become snake_case so extra columns don’t break parsing.
 */
export function normalizeBenefitUnitOwnerColumnName(raw: string): string {
    const t = raw.trim()
    if (!t) return "__empty_header__"

    if (/^#\s*of$/i.test(t)) return "num_of"

    const spaced = t.toLowerCase().replace(/\s+/g, " ").trim()
    const nospace = spaced.replace(/\s/g, "")
    const underscored = spaced.replace(/\s/g, "_")

    for (const key of [t, spaced, nospace, underscored, t.toLowerCase()]) {
        const hit = ALIAS_MAP[key]
        if (hit) return hit
    }

    const snake = toSnakeCase(t)
    if (snake === "mailder_id") return "mailer_id"
    if (BENEFIT_UNIT_OWNER_CANONICAL_FIELDS.has(snake)) return snake

    return snake
}

export function escapeCsvField(field: string): string {
    /** Quote `#`-leading cells so Excel does not treat the row as a comment; escape commas/newlines. */
    if (/[",\n\r]/.test(field) || field.startsWith("#")) {
        return `"${field.replace(/"/g, '""')}"`
    }
    return field
}

/** Single header line for the template file (UTF-8 will get BOM in the browser download helper). */
export function buildBenefitUnitOwnerTemplateCsvHeaderLine(): string {
    return BENEFIT_UNIT_OWNER_TEMPLATE_HEADERS.map(escapeCsvField).join(",") + "\r\n"
}
