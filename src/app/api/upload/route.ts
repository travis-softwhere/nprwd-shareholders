import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
//import { v4 as uuidv4 } from "uuid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    const startTime = Date.now()

    // Generate a random 6-digit numeric ID instead of UUID
    const generateRandomId = () => {
        return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
    };


    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            throw new Error("Unauthorized")
        }

        // Get form data with error boundary
        let formData: FormData
        try {
            formData = await request.formData()
        } catch (error) {
            throw new Error(`Failed to parse form data: ${error}`)
        }

        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            throw new Error("Missing required fields")
        }

        // Read file content with error boundary
        let content: string
        try {
            content = await file.text()
        } catch (error) {
            throw new Error(`Failed to read file: ${error}`)
        }

        // Parse CSV with error boundary
        let records: any[]
        try {
            records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            })

            records = records.filter(
                (record) =>
                Object.values(record).some(
                    (value) => typeof value === "string" && value.trim() !== ""
                )
            )

            console.log('Records: ', records)
        } catch (error) {
            throw new Error(`Failed to parse CSV: ${error}`)
        }

        // Clear existing data
        try {
            const existingShareholders = await db
                .select({ shareholderId: shareholders.shareholderId })
                .from(shareholders)
                .where(eq(shareholders.meetingId, meetingId))

            if (existingShareholders.length > 0) {
                const shareholderIds = existingShareholders.map((s) => s.shareholderId)
                await db.delete(properties).where(inArray(properties.shareholderId, shareholderIds))
                await db.delete(shareholders).where(eq(shareholders.meetingId, meetingId))
            }
        } catch (error) {
            throw new Error(`Failed to clear existing data: ${error}`)
        }

        // Process records
        const uniqueShareholders = new Map()
        const batchSize = 50
        let processedCount = 0

        try {
            while (processedCount < records.length) {
                const batch = records.slice(processedCount, processedCount + batchSize)
                const shareholderValues = []
                const propertyValues = []

                for (const record of batch) {
                    const ownerKey = [
                        record.owner_mailing_address?.trim() || "",
                        record.owner_city_state_zip?.trim() || ""
                      ].join("|")
                      
                    let shareholderId = uniqueShareholders.get(ownerKey)

                    if (!shareholderId) {
                        shareholderId = generateRandomId()
                        uniqueShareholders.set(ownerKey, shareholderId)
                        shareholderValues.push({
                            name: record.owner_name?.trim() || "Unknown",
                            meetingId,
                            shareholderId,
                        })
                    }

                    propertyValues.push({
                        account: record.account || "",
                        shareholderId,
                        numOf: record.num_of || "",
                        customerName: record.customer_name || "",
                        customerMailingAddress: record.customer_mailing_address || "",
                        cityStateZip: record.city_state_zip || "",
                        ownerName: record.owner_name || "",
                        ownerMailingAddress: record.owner_mailing_address || "",
                        ownerCityStateZip: record.owner_city_state_zip || "",
                        residentName: record.resident_name || "",
                        residentMailingAddress: record.resident_mailing_address || "",
                        residentCityStateZip: record.resident_city_state_zip || "",
                        serviceAddress: record.service_address || "",
                    })
                }

                if (shareholderValues.length > 0) {
                    await db.insert(shareholders).values(shareholderValues).onConflictDoNothing()
                }

                if (propertyValues.length > 0) {
                    await db.insert(properties).values(propertyValues)
                }

                processedCount += batch.length
            }
        } catch (error) {
            throw new Error(`Failed to process records: ${error}`)
        }

        // Update meeting statistics
        try {
            await db
                .update(meetings)
                .set({ totalShareholders: uniqueShareholders.size })
                .where(eq(meetings.id, Number.parseInt(meetingId)))
        } catch (error) {
            throw new Error(`Failed to update meeting statistics: ${error}`)
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${records.length} records in ${totalTime} seconds`,
            totalRecords: records.length,
            totalShareholders: uniqueShareholders.size,
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        )
    }
}