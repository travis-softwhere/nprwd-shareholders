import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { parse } from "csv-parse/sync"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { shareholders } from "@/lib/db/schema"
import { meetings } from "@/lib/db/schema" 
import { logToFile, LogLevel } from "@/utils/logger"
import { desc } from "drizzle-orm"
import { sql } from "drizzle-orm"


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
}

function getCSVData(): Property[] {
    const rootDir = process.cwd()
    const filePath = path.join(rootDir, "public", "PropertyList.csv")
    const fileContent = fs.readFileSync(filePath, "utf-8")

    const records = parse(fileContent, {
        columns: (header: string[]) => {
            return header.map((column) => {
                // Map CSV headers to our interface properties
                switch (column) {
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
                        return column
                }
            })
        },
        skip_empty_lines: true,
    })

    return records.map((record: any) => ({
        ...record,
        checkedIn: record.checkedIn === "true",
    }))
}

// GET endpoint for retrieving shareholder data
export async function GET(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        
        // Get shareholders from the database
        const allShareholders = await db.select().from(shareholders);
        
        return NextResponse.json({ shareholders: allShareholders })
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch shareholders" }, { status: 500 })
    }
}

// POST endpoint for creating a new shareholder
export async function POST(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("shareholders", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get request body
        const body = await request.json()
        const { name, shareholderId } = body

        if (!name || !shareholderId) {
            return NextResponse.json(
                { error: "Shareholder name and ID are required" },
                { status: 400 }
            )
        }

        // Format name in uppercase to maintain consistency
        const formattedName = name.trim().toUpperCase()

        // Get the latest active meeting
        const latestMeetings = await db
            .select()
            .from(meetings)
            .orderBy(desc(meetings.year))
            .limit(1)

        if (!latestMeetings || latestMeetings.length === 0) {
            return NextResponse.json(
                { error: "No active meeting found to associate shareholder with" },
                { status: 400 }
            )
        }

        const meetingId = latestMeetings[0].id.toString()

        // Create new shareholder
        const newShareholder = await db
            .insert(shareholders)
            .values({
                name: formattedName,
                shareholderId,
                meetingId,
                isNew: true
            })
            .returning()

        await logToFile("shareholders", "New shareholder created", LogLevel.INFO, {
            shareholderId
        })

        return NextResponse.json(newShareholder[0])
    } catch (error) {
        await logToFile("shareholders", "Error creating shareholder", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        })

        return NextResponse.json(
            { error: "Failed to create shareholder" },
            { status: 500 }
        )
    }
}

export async function PUT(request: Request) {
    try {
        const { shareholderId, isCheckedIn } = await request.json()
        
        
        const filePath = path.join(process.cwd(), "public", "PropertyList.csv")
        const properties = getCSVData()

        const updatedProperties = properties.map((p) =>
            p.account === shareholderId ? { ...p, checkedIn: isCheckedIn } : p,
        )

        // Convert back to CSV format with original headers
        const headers = [
            "account",
            "# of",
            "customer_name",
            "customer_mailing_address",
            "city_state_zip",
            "owner_name",
            "owner_mailing_address",
            "owner_city_state_zip",
            "resident_name",
            "resident_mailing_address",
            "resident_city_state_zip",
            "service_address",
            "checked_in",
        ]

        const csvContent = [
            headers.join(","),
            ...updatedProperties.map((p) =>
                [
                    p.account,
                    p.numOf,
                    p.customerName,
                    p.customerMailingAddress,
                    p.cityStateZip,
                    p.ownerName,
                    p.ownerMailingAddress,
                    p.ownerCityStateZip,
                    p.residentName,
                    p.residentMailingAddress,
                    p.residentCityStateZip,
                    p.serviceAddress,
                    p.checkedIn,
                ].join(","),
            ),
        ].join("\n")

        fs.writeFileSync(filePath, csvContent, "utf-8")
        
        return NextResponse.json({ success: true })
    } catch (error) {

        return NextResponse.json({ error: "Failed to update data" }, { status: 500 })
    }
}