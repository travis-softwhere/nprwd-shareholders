import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { logToFile } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Increase the response timeout and memory limit
export const maxDuration = 300 // 5 minutes
export const runtime = "nodejs" // Ensure we're using Node.js runtime

// Helper function to send progress updates
async function sendProgress(writer: WritableStreamDefaultWriter<Uint8Array>, progress: number, step: string) {
    try {
        console.log(`Sending progress update: ${progress}% - ${step}`)
        const encoder = new TextEncoder()
        await writer.write(
            encoder.encode(
                `data: ${JSON.stringify({
                    type: "progress",
                    progress,
                    step,
                })}\n\n`,
            ),
        )
    } catch (error) {
        console.error("Error sending progress update:", error)
    }
}

export async function POST(request: Request) {
    console.log("File upload process started")

    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const res = new TransformStream()
    const writer = res.writable.getWriter()

    try {
        await logToFile("upload", "📤 Starting file upload process...")
        await sendProgress(writer, 0, "Initializing upload...")

        const formData = await request.formData()
        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            throw new Error("No file or meeting ID provided")
        }

        console.log(`Processing file: ${file.name} (${file.size} bytes) for meeting: ${meetingId}`)
        await sendProgress(writer, 5, "Reading file contents...")

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const content = buffer.toString()

        // Validate CSV content
        if (!content.trim()) {
            throw new Error("File is empty")
        }

        await sendProgress(writer, 10, "Parsing CSV file...")

        // Parse CSV with error handling
        let records
        try {
            records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relaxColumnCount: true,
                skipRecordsWithError: true,
            })
        } catch (error) {
            console.error("CSV parsing error:", error)
            throw new Error("Invalid CSV format")
        }

        if (!records.length) {
            throw new Error("No valid records found in file")
        }

        console.log(`CSV parsing completed. Total records: ${records.length}`)
        await sendProgress(writer, 20, `Found ${records.length} records to process...`)

        // Process records in smaller batches
        const batchSize = 10
        const uniqueShareholders = new Map()
        const shareholdersList: { name: string; shareholderId: string }[] = []

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const progress = 20 + (i / records.length) * 60

            await Promise.all(
                batch.map(async (record: any) => {
                    try {
                        const ownerName = record.owner_name?.trim() || "Unknown"

                        if (!uniqueShareholders.has(ownerName)) {
                            const shareholderId = uuidv4()
                            uniqueShareholders.set(ownerName, shareholderId)
                            shareholdersList.push({ name: ownerName, shareholderId })

                            await db
                                .insert(shareholders)
                                .values({
                                    name: ownerName,
                                    meetingId,
                                    shareholderId,
                                })
                                .onConflictDoUpdate({
                                    target: shareholders.shareholderId,
                                    set: { name: ownerName, meetingId },
                                })
                        }

                        const shareholderId = uniqueShareholders.get(ownerName)
                        await db.insert(properties).values({
                            account: record.account || "",
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
                            shareholderId,
                        })
                    } catch (error) {
                        console.error("Error processing record:", error)
                    }
                }),
            )

            await sendProgress(
                writer,
                progress,
                `Processing records ${i + 1} to ${Math.min(i + batchSize, records.length)} of ${records.length}...`,
            )
        }

        // Update meeting statistics
        await db
            .update(meetings)
            .set({ totalShareholders: uniqueShareholders.size })
            .where(eq(meetings.id, Number.parseInt(meetingId)))

        await sendProgress(writer, 100, "Upload completed successfully!")

        // Send completion message
        await writer.write(
            new TextEncoder().encode(
                `data: ${JSON.stringify({
                    type: "complete",
                    success: true,
                    message: `Successfully processed ${records.length} records`,
                    totalRecords: records.length,
                    totalShareholders: uniqueShareholders.size,
                })}\n\n`,
            ),
        )
    } catch (error) {
        console.error("Error in upload process:", error)
        await logToFile("upload", `❌ Error in upload process: ${error}`)

        try {
            await writer.write(
                new TextEncoder().encode(
                    `data: ${JSON.stringify({
                        type: "error",
                        error: error instanceof Error ? error.message : "Failed to process upload",
                    })}\n\n`,
                ),
            )
        } catch (writeError) {
            console.error("Error sending error message:", writeError)
        }
    } finally {
        try {
            await writer.close()
        } catch (error) {
            console.error("Error closing writer:", error)
        }
    }

    return new NextResponse(res.readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}