import fs from "fs"
import path from "path"
import { parse } from "csv-parse/sync"

export interface Property {
    account: string
    numOf: string
    customerName: string
    customerMailingAddress: string
    cityStateZip: string
    ownerName: string
    ownerMailingAddress: string
    ownerCityStateZip: string
    residentName: string
    residentMailingAddress: string
    residentCityStateZip: string
    serviceAddress: string
    checkedIn: boolean
    shareholderId: string
}

export async function getProperties(
    page = 1,
    itemsPerPage = 25,
): Promise<{ properties: Property[]; totalProperties: number }> {
    const filePath = path.join(process.cwd(), "public", "PropertyList.csv")
    const fileContent = fs.readFileSync(filePath, "utf-8")

    const records = parse(fileContent, {
        columns: (header: string[]) => {
            return header.map((column) => {
                // Map CSV headers to our interface properties
                switch (column.trim()) {
                    case "account":
                        return "account"
                    case "# of":
                        return "numOf"
                    case "customer_name":
                        return "customerName"
                    case "customer_mailing_address":
                        return "customerMailingAddress"
                    case "city_state_zip":
                        return "cityStateZip"
                    case "owner_name":
                        return "ownerName"
                    case "owner_mailing_address":
                        return "ownerMailingAddress"
                    case "owner_city_state_zip":
                        return "ownerCityStateZip"
                    case "resident_name":
                        return "residentName"
                    case "resident_mailing_address":
                        return "residentMailingAddress"
                    case "resident_city_state_zip":
                        return "residentCityStateZip"
                    case "service_address":
                        return "serviceAddress"
                    case "checked_in":
                        return "checkedIn"
                    default:
                        return column.toLowerCase().replace(/\s+/g, "")
                }
            })
        },
        skip_empty_lines: true,
        trim: true,
    })

    const totalProperties = records.length
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage

    const properties = records.slice(startIndex, endIndex).map((record: any) => ({
        ...record,
        numOf: record.numOf || "1", // Default to 1 if empty
        checkedIn: record.checkedIn === "true", // Convert to boolean
        shareholderId: record.shareholder_id || record.account, // Use account if shareholder_id is empty
    }))

    return { properties, totalProperties }
}

export async function getShareholderProperties(shareholderId: string): Promise<Property[]> {
    const { properties } = await getProperties(1, Number.MAX_SAFE_INTEGER)
    return properties.filter((p) => p.shareholderId === shareholderId || p.account === shareholderId)
}

// export async function updateCheckedInStatus(shareholderId: string, isCheckedIn: boolean): Promise<void> {
//     console.log("Updating checked in status for shareholderId:", shareholderId, "to", isCheckedIn)
//     const filePath = path.join(process.cwd(), "public", "PropertyList.csv")
//     const fileContent = fs.readFileSync(filePath, "utf-8")

//     const records = parse(fileContent, {
//         columns: true,
//         skip_empty_lines: true,
//         trim: true,
//     })

//     const updatedRecords = records.map((record: any) => {
//         if (record.account === shareholderId) {
//             return { ...record, checkedIn: isCheckedIn.toString() }
//         }
//         return record
//     })

//     // Convert records back to CSV string
//     const header = Object.keys(updatedRecords[0]).join(",")
//     const rows = updatedRecords.map((record: any) =>
//         Object.values(record)
//             .map((value) => (typeof value === "string" && value.includes(",") ? `"${value}"` : value))
//             .join(","),
//     )
//     const updatedContent = [header, ...rows].join("\n")

//     fs.writeFileSync(filePath, updatedContent, "utf-8")
// }

export async function getShareholderIds(): Promise<string[]> {
    const { properties } = await getProperties(1, Number.MAX_SAFE_INTEGER)
    return Array.from(new Set(properties.map((p) => p.account)))
}