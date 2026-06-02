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

export type PropertySearchContext = {
    /** When set, a query that matches any service address only returns those properties (not owner/customer mailing matches). */
    properties?: Property[]
}

function serviceAddressMatchesQuery(property: Property, q: string): boolean {
    const addr = property.serviceAddress?.trim().toLowerCase()
    return !!addr && addr.includes(q)
}

function anyServiceAddressMatches(properties: Property[], q: string): boolean {
    return properties.some((p) => serviceAddressMatchesQuery(p, q))
}

/** Case-insensitive match across searchable property text columns (and check-in status keywords). */
export function propertyMatchesSearch(
    property: Property,
    query: string,
    context?: PropertySearchContext,
): boolean {
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

    const pool = context?.properties
    if (pool?.length && anyServiceAddressMatches(pool, q)) {
        return serviceAddressMatchesQuery(property, q)
    }

    return TEXT_FIELDS.some((key) => {
        const value = property[key]
        return typeof value === "string" && value.toLowerCase().includes(q)
    })
}
