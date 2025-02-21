import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { logToFile, LogLevel } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    const uploadId = uuidv4()
    const startTime = Date.now()

    try {
        await logToFile("upload", `Starting upload ${uploadId}`, LogLevel.INFO)
        console.log("Starting upload process")

        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            throw new Error("Unauthorized")
        }

        // Get form data with error boundary
        let formData: FormData
        try {
            formData = await request.formData()
            console.log("FormData received")
            await logToFile("upload", "FormData received", LogLevel.INFO)
        } catch (error) {
            console.error("FormData error:", error)
            throw new Error(`Failed to parse form data: ${error}`)
        }

        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            throw new Error("Missing required fields")
        }

        console.log("File details:", {
            name: file.name,
            size: file.size,
            type: file.type,
        })

        // Read file content with error boundary
        let content: string
        try {
            content = await file.text()
            console.log("File content read, length:", content.length)
            await logToFile("upload", "File content read", LogLevel.INFO, {
                contentLength: content.length,
                firstLine: content.split("\n")[0],
            })
        } catch (error) {
            console.error("File reading error:", error)
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
            console.log("CSV parsed, records:", records.length)
            await logToFile("upload", "CSV parsed", LogLevel.INFO, {
                recordCount: records.length,
            })
        } catch (error) {
            console.error("CSV parsing error:", error)
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
                console.log("Existing data cleared")
            }
        } catch (error) {
            console.error("Database clear error:", error)
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
                    const ownerName = record.owner_name?.trim() || "Unknown"
                    let shareholderId = uniqueShareholders.get(ownerName)

                    if (!shareholderId) {
                        shareholderId = uuidv4()
                        uniqueShareholders.set(ownerName, shareholderId)
                        shareholderValues.push({
                            name: ownerName,
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
                console.log(`Processed ${processedCount}/${records.length} records`)
                await logToFile("upload", "Batch processed", LogLevel.INFO, {
                    processedCount,
                    totalRecords: records.length,
                })
            }
        } catch (error) {
            console.error("Processing error:", error)
            throw new Error(`Failed to process records: ${error}`)
        }

        // Update meeting statistics
        try {
            await db
                .update(meetings)
                .set({ totalShareholders: uniqueShareholders.size })
                .where(eq(meetings.id, Number.parseInt(meetingId)))
        } catch (error) {
            console.error("Statistics update error:", error)
            throw new Error(`Failed to update meeting statistics: ${error}`)
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`Upload completed in ${totalTime}s`)
        await logToFile("upload", "Upload completed", LogLevel.INFO, {
            duration: totalTime,
            totalRecords: records.length,
            totalShareholders: uniqueShareholders.size,
        })

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${records.length} records in ${totalTime} seconds`,
            totalRecords: records.length,
            totalShareholders: uniqueShareholders.size,
        })
    } catch (error) {
        console.error("Upload failed:", error)
        await logToFile("upload", `Upload failed: ${error}`, LogLevel.ERROR)

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        )
    }
}