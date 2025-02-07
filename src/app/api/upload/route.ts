import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { logToFile } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

// Increase the response timeout and memory limit
export const maxDuration = 300 // 5 minutes
export const runtime = "nodejs" // Ensure we're using Node.js runtime

// Helper function to send progress updates
async function sendProgress(writer: WritableStreamDefaultWriter<Uint8Array>, progress: number, step: string) {
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
}

// Add interface for CSV record structure
interface CSVRecord {
    owner_name: string
    account: string
    num_of: string
    customer_name: string
    customer_mailing_address: string
    city_state_zip: string
    owner_mailing_address: string
    owner_city_state_zip: string
    resident_name: string
    resident_mailing_address: string
    resident_city_state_zip: string
    service_address: string
}

export async function POST(request: Request) {
    console.log("File upload process started")
    const res = new TransformStream()
    const writer = res.writable.getWriter()

    try {
        await logToFile("upload", "📤 Starting file upload process...")
        console.log("Initializing upload...")
        await sendProgress(writer, 0, "Initializing upload...")

        const formData = await request.formData()
        console.log("FormData received")
        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            console.error("No file or meeting ID provided")
            throw new Error("No file or meeting ID provided")
        }

        console.log(`Processing file: ${file.name} for meeting: ${meetingId}`)
        await logToFile("upload", `📋 Processing file: ${file.name} for meeting: ${meetingId}`)
        await sendProgress(writer, 5, "Reading file contents...")

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        console.log(`File size: ${buffer.length} bytes`)

        // Stage 1: Parse CSV
        console.log("Starting CSV parsing")
        await logToFile("csv-parsing", "Starting CSV parsing")
        await sendProgress(writer, 10, "Parsing CSV file...")

        const records = parse(buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relaxColumnCount: true, // Add this to be more forgiving with CSV format
            skipRecordsWithError: true, // Skip records that can't be parsed
        })

        console.log(`CSV parsing completed. Total records: ${records.length}`)
        await logToFile("csv-parsing", `CSV parsing completed. Total records: ${records.length}`)
        await sendProgress(writer, 20, `Found ${records.length} records to process...`)

        // Stage 2: Insert Data
        console.log("Starting data insertion")
        await logToFile("data-insertion", "Starting data insertion")
        await sendProgress(writer, 25, "Beginning data insertion...")

        const uniqueShareholders = new Map()
        const shareholdersList: { name: string; shareholderId: string }[] = []
        const batchSize = 50 // Process records in batches

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const progress = 25 + (i / records.length) * 60
            console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(records.length / batchSize)}`)

            await Promise.all(
                batch.map(async (record: CSVRecord) => {
                    try {
                        const ownerName = record.owner_name?.trim() || "Unknown"

                        if (!uniqueShareholders.has(ownerName)) {
                            const shareholderId = uuidv4()
                            uniqueShareholders.set(ownerName, shareholderId)
                            shareholdersList.push({ name: ownerName, shareholderId })

                            console.log(`Inserting new shareholder: ${ownerName}`)
                            // Insert shareholder
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

                        console.log(`Inserting property for shareholder: ${ownerName}`)
                        // Insert property
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
                        console.error(`Error processing record:`, error)
                        await logToFile("upload", `Error processing record: ${error}`)
                    }
                }),
            )

            await sendProgress(
                writer,
                progress,
                `Processing records ${i + 1} to ${Math.min(i + batchSize, records.length)} of ${records.length}...`,
            )
        }

        console.log(`Data insertion completed. Total shareholders: ${uniqueShareholders.size}`)
        await logToFile("data-insertion", `Data insertion completed. Total shareholders: ${uniqueShareholders.size}`)
        await sendProgress(writer, 85, "Finalizing data insertion...")

        // Stage 3: Sort Shareholders List
        console.log("Starting shareholders list sorting")
        await logToFile("shareholders-sorting", "Starting shareholders list sorting")
        await sendProgress(writer, 90, "Sorting shareholder list...")

        const sortedShareholdersList = shareholdersList.sort((a, b) => a.name.localeCompare(b.name))

        console.log(`Shareholders list sorting completed. Total shareholders: ${sortedShareholdersList.length}`)
        await logToFile(
            "shareholders-sorting",
            `Shareholders list sorting completed. Total shareholders: ${sortedShareholdersList.length}`,
        )
        await sendProgress(writer, 95, "Updating meeting statistics...")

        // Update meeting total shareholders
        console.log(`Updating meeting (ID: ${meetingId}) with total shareholders: ${uniqueShareholders.size}`)
        await db
            .update(meetings)
            .set({ totalShareholders: uniqueShareholders.size })
            .where(eq(meetings.id, Number.parseInt(meetingId)))

        console.log("File upload process completed successfully")
        await logToFile("upload", "✅ File upload process completed successfully")
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
                    sortedShareholdersList,
                })}\n\n`,
            ),
        )
    } catch (error) {
        console.error("Error in upload process:", error)
        await logToFile("upload", `❌ Error in upload process: ${error}`)
        await writer.write(
            new TextEncoder().encode(
                `data: ${JSON.stringify({
                    type: "error",
                    error: error instanceof Error ? error.message : "Failed to process upload",
                })}\n\n`,
            ),
        )
    } finally {
        await writer.close()
    }

    return new NextResponse(res.readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}