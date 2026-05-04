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
]

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
