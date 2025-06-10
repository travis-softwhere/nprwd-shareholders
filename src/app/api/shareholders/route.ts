import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { parse } from "csv-parse/sync"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { logToFile, LogLevel } from "@/utils/logger"

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
        
        // Parse shareholderId and meetingId from query params
        const url = new URL(request.url);
        const shareholderId = url.searchParams.get("shareholderId");
        const meetingId = url.searchParams.get("meetingId");
        
        if (shareholderId) {
            // Get the specific shareholder from the database
            const shareholder = await queryOne<{
                id: number;
                shareholder_id: string;
                name: string;
                meeting_id: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                is_new: boolean;
                created_at: Date;
                comment: string;
            }>(
                'SELECT * FROM shareholders WHERE shareholder_id = $1',
                [shareholderId]
            );

            if (!shareholder) {
                return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
            }

            // Also fetch properties for this shareholder
            const props = await query<{
                id: number;
                account: string;
                shareholder_id: string;
                num_of: string;
                customer_name: string;
                customer_mailing_address: string;
                city_state_zip: string;
                owner_name: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                resident_name: string;
                resident_mailing_address: string;
                resident_city_state_zip: string;
                service_address: string;
                checked_in: boolean;
                created_at: Date;
            }>(
                'SELECT * FROM properties WHERE shareholder_id = $1',
                [shareholderId]
            );

            return NextResponse.json({
                shareholder: {
                    ...shareholder,
                    properties: props
                }
            });
        }

        // Get all shareholders from the database, optionally filter by meetingId
        let shareholders;
        if (meetingId) {
            shareholders = await query<{
                id: number;
                shareholder_id: string;
                name: string;
                meeting_id: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                is_new: boolean;
                created_at: Date;
                comment: string;
            }>(
                'SELECT * FROM shareholders WHERE meeting_id = $1',
                [meetingId]
            );
        } else {
            shareholders = await query<{
                id: number;
                shareholder_id: string;
                name: string;
                meeting_id: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                is_new: boolean;
                created_at: Date;
                comment: string;
            }>('SELECT * FROM shareholders');
        }

        // Get all properties for these shareholders
        const shareholderIds = shareholders.map(s => s.shareholder_id);
        const allProperties = shareholderIds.length
            ? await query<{
                id: number;
                account: string;
                shareholder_id: string;
                num_of: string;
                customer_name: string;
                customer_mailing_address: string;
                city_state_zip: string;
                owner_name: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                resident_name: string;
                resident_mailing_address: string;
                resident_city_state_zip: string;
                service_address: string;
                checked_in: boolean;
                created_at: Date;
            }>(
                'SELECT * FROM properties WHERE shareholder_id = ANY($1)',
                [shareholderIds]
            )
            : [];

        // Group properties by shareholderId
        const propMap = new Map();
        for (const prop of allProperties) {
            if (!propMap.has(prop.shareholder_id)) propMap.set(prop.shareholder_id, []);
            propMap.get(prop.shareholder_id).push(prop);
        }

        // Attach properties array to each shareholder
        const result = shareholders.map(s => ({
            ...s,
            properties: propMap.get(s.shareholder_id) || []
        }));

        return NextResponse.json({ shareholders: result })
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
        const { name, shareholderId, ownerMailingAddress, ownerCityStateZip } = body

        if (!name || !shareholderId) {
            return NextResponse.json(
                { error: "Shareholder name and ID are required" },
                { status: 400 }
            )
        }

        // Format name in uppercase to maintain consistency
        const formattedName = name.trim().toUpperCase()

        // Get the latest active meeting
        const latestMeeting = await queryOne<{ id: number; year: number }>(
            'SELECT id, year FROM meetings ORDER BY year DESC LIMIT 1'
        );

        if (!latestMeeting) {
            return NextResponse.json(
                { error: "No active meeting found to associate shareholder with" },
                { status: 400 }
            )
        }

        const meetingId = latestMeeting.id.toString()

        // Create new shareholder
        console.log('New address for new shareholder: ', ownerMailingAddress, ownerCityStateZip)
        const newShareholder = await queryOne<{
            id: number;
            shareholder_id: string;
            name: string;
            meeting_id: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            is_new: boolean;
            created_at: Date;
        }>(
            `INSERT INTO shareholders 
            (name, shareholder_id, meeting_id, is_new, owner_mailing_address, owner_city_state_zip)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [formattedName, shareholderId, meetingId, true, ownerMailingAddress, ownerCityStateZip]
        );

        await logToFile("shareholders", "New shareholder created", LogLevel.INFO, {
            shareholderId
        })

        return NextResponse.json(newShareholder)
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