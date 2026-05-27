import type { Property } from "@/types/Property"

const TEXT_FIELDS: (keyof Property)[] = [
    "account",
    "numOf",
    "shareholderId",
    "serviceAddress",
    "cityStateZip",
    "customerName",
    "customerMailingAddress",
    "ownerName",
    "ownerMailingAddress",
    "ownerCityStateZip",
    "residentName",
    "residentMailingAddress",
    "residentCityStateZip",
]

/** Case-insensitive match across all searchable property text columns (and check-in status keywords). */
export function propertyMatchesSearch(property: Property, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true

    if (
        (q === "checked" || q === "checked in" || q === "yes") &&
        property.checkedIn
    ) {
        return true
    }
    if (
        (q === "unchecked" ||
            q === "not checked" ||
            q === "not checked in" ||
            q === "no") &&
        !property.checkedIn
    ) {
        return true
    }

    return TEXT_FIELDS.some((key) => {
        const value = property[key]
        return typeof value === "string" && value.toLowerCase().includes(q)
    })
}
