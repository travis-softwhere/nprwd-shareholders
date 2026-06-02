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
import { properties } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import {
    canonicalShareholderId,
    shareholderIdLookupCandidates,
} from "@/lib/meetingScopedShareholderId"
import { ensureShareholdersSharedIdColumn } from "@/lib/db/ensure-shareholders-shared-id"
import { ensurePropertySignatureColumns } from "@/lib/db/ensure-property-signature-columns"

const DEBUG_SH_QUERY = process.env.DEBUG_SHAREHOLDERS_QUERY === "1"

async function logShareholdersQueryDebug(entry: {
    meetingIdParam: string | null
    listAll: boolean
    sqlMeetingIdVariants: string[] | null
    meetingRow: { id: number; year: number; date: string } | null
    count: number
    shareholders: { shareholderId: string; name: string; meetingId: string }[]
}) {
    const line =
        JSON.stringify({
            ts: new Date().toISOString(),
            source: "GET /api/shareholders",
            ...entry,
        }) + "\n"
    const logsDir = path.join(process.cwd(), "logs")
    await fs.promises.mkdir(logsDir, { recursive: true })
    await fs.promises.appendFile(path.join(logsDir, "database.log"), line, "utf-8")
    await fs.promises.appendFile(path.join(logsDir, "shareholders-query.log"), line, "utf-8")
    console.log(
        "[DEBUG_SHAREHOLDERS_QUERY] meetingId=%s listAll=%s variants=%j count=%d ids=%s",
        entry.meetingIdParam,
        entry.listAll,
        entry.sqlMeetingIdVariants,
        entry.count,
        entry.shareholders.map((s) => s.shareholderId).join(","),
    )
}

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

        await ensureShareholdersSharedIdColumn()
        await ensurePropertySignatureColumns()

        // Parse shareholderId and meetingId from query params
        const url = new URL(request.url);
        const shareholderId = url.searchParams.get("shareholderId");
        const meetingIdParam = url.searchParams.get("meetingId");
        const listAll = url.searchParams.get("listAll") === "true";

        console.log("Query params:", { shareholderId, meetingId: meetingIdParam, listAll });
        
        if (shareholderId) {
            const lookupIds = shareholderIdLookupCandidates(shareholderId, meetingIdParam)
            let result: (typeof shareholders.$inferSelect)[] = []
            let resolvedId = shareholderId.trim()
            for (const candidate of lookupIds) {
                const rows = await db
                    .select()
                    .from(shareholders)
                    .where(eq(shareholders.shareholderId, candidate))
                if (rows.length > 0) {
                    result = rows
                    resolvedId = candidate
                    break
                }
            }
            if (result.length === 0) {
                return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
            }
            if (meetingIdParam) {
                const variants = await shareholderMeetingIdVariantsForFilter(meetingIdParam)
                const rowMid = String(result[0].meetingId).trim()
                if (!variants.includes(rowMid)) {
                    return NextResponse.json(
                        { error: "This benefit unit owner is not part of the selected meeting." },
                        { status: 404 }
                    )
                }
            }
            const props = await db
                .select()
                .from(properties)
                .where(eq(properties.shareholderId, resolvedId));
            return NextResponse.json({ shareholder: { ...result[0], properties: props } });
        }
        // Get all shareholders from the database; optional meeting scope or admin list-all
        let allShareholders;
        let sqlMeetingIdVariants: string[] | null = null;
        try {
            if (listAll) {
                if (session.user?.isAdmin !== true) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
                }
                allShareholders = await db.select().from(shareholders);
            } else if (meetingIdParam) {
                const mid = String(meetingIdParam).trim();
                sqlMeetingIdVariants = await shareholderMeetingIdVariantsForFilter(mid);
                allShareholders = await db
                    .select()
                    .from(shareholders)
                    .where(inArray(shareholders.meetingId, sqlMeetingIdVariants));
            } else {
                allShareholders = await db.select().from(shareholders);
            }
        } catch (dbError) {
            console.error("Database error:", dbError);
            throw dbError;
        }

        if (DEBUG_SH_QUERY) {
            let meetingRow: { id: number; year: number; date: string } | null = null;
            if (meetingIdParam) {
                const pk = parseInt(String(meetingIdParam).trim(), 10);
                if (!Number.isNaN(pk)) {
                    const rows = await db
                        .select({
                            id: meetings.id,
                            year: meetings.year,
                            date: meetings.date,
                        })
                        .from(meetings)
                        .where(eq(meetings.id, pk))
                        .limit(1);
                    if (rows[0]) {
                        meetingRow = {
                            id: rows[0].id,
                            year: rows[0].year,
                            date:
                                rows[0].date instanceof Date
                                    ? rows[0].date.toISOString()
                                    : String(rows[0].date),
                        };
                    }
                }
            }
            await logShareholdersQueryDebug({
                meetingIdParam,
                listAll,
                sqlMeetingIdVariants,
                meetingRow,
                count: allShareholders.length,
                shareholders: allShareholders.map((s) => ({
                    shareholderId: s.shareholderId,
                    name: s.name,
                    meetingId: s.meetingId,
                })),
            });
        }

        // Get all properties for these shareholders
        const allShareholderIds = allShareholders.map(s => s.shareholderId);
        const allProperties = allShareholderIds.length
            ? await db.select().from(properties).where(inArray(properties.shareholderId, allShareholderIds))
            : [];

        // Group properties by shareholderId
        const propMap = new Map();
        for (const prop of allProperties) {
            if (!propMap.has(prop.shareholderId)) propMap.set(prop.shareholderId, []);
            propMap.get(prop.shareholderId).push(prop);
        }

        // Attach properties array to each shareholder
        const result = allShareholders.map(s => ({
            ...s,
            properties: propMap.get(s.shareholderId) || []
        }));

        return NextResponse.json({ shareholders: result })
    } catch (error) {
        console.error("Error in GET /api/shareholders:", error);
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

        await ensureShareholdersSharedIdColumn()

        // Get request body
        const body = await request.json()
        const { name, shareholderId, ownerMailingAddress, ownerCityStateZip, meetingId: meetingIdFromBody } = body

        if (!name || !shareholderId) {
            return NextResponse.json(
                { error: "Shareholder name and ID are required" },
                { status: 400 }
            )
        }

        // Format name in uppercase to maintain consistency
        const formattedName = name.trim().toUpperCase()

        let meetingId: string

        const rawMeetingId =
            meetingIdFromBody !== undefined && meetingIdFromBody !== null
                ? String(meetingIdFromBody).trim()
                : ""

        if (rawMeetingId.length > 0) {
            const idNum = Number(rawMeetingId)
            if (!Number.isFinite(idNum)) {
                return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 })
            }
            const rows = await db.select().from(meetings).where(eq(meetings.id, idNum)).limit(1)
            if (!rows.length) {
                return NextResponse.json({ error: "Meeting not found" }, { status: 400 })
            }
            meetingId = String(rows[0].id)
        } else {
            const latestMeetings = await db.select().from(meetings).orderBy(desc(meetings.year)).limit(1)

            if (!latestMeetings || latestMeetings.length === 0) {
                return NextResponse.json(
                    { error: "No active meeting found to associate shareholder with" },
                    { status: 400 }
                )
            }

            meetingId = latestMeetings[0].id.toString()
        }

        const scopedShareholderId = canonicalShareholderId(String(shareholderId).trim(), meetingId)

        console.log('New address for new shareholder: ', ownerMailingAddress, ownerCityStateZip)
        const newShareholder = await db
            .insert(shareholders)
            .values({
                name: formattedName,
                shareholderId: scopedShareholderId,
                meetingId,
                isNew: true,
                ownerMailingAddress,
                ownerCityStateZip
            })
            .returning()

        await logToFile("shareholders", "New shareholder created", LogLevel.INFO, {
            shareholderId: scopedShareholderId,
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