import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { logToFile } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
    await logToFile("upload", "📤 Starting file upload process...")

    try {
        const formData = await request.formData()
        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            await logToFile("upload", "❌ Missing file or meeting ID")
            return NextResponse.json({ error: "No file or meeting ID provided" }, { status: 400 })
        }

        await logToFile("upload", `📋 Processing file: ${file.name} for meeting: ${meetingId}`)

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Parse CSV to get total record count
        const records = parse(buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
        })

        const totalRecords = records.length
        await logToFile("upload", `📊 Total records to process: ${totalRecords}`)

        // Process records in chunks to show progress
        const chunkSize = 100
        const uniqueShareholders = new Map()

        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize)
            const processedCount = Math.min(i + chunkSize, records.length)
            const progress = Math.round((processedCount / totalRecords) * 100)

            await logToFile("upload", `⏳ Processing records ${i + 1} to ${processedCount} of ${totalRecords} (${progress}%)`)

            // Clean and process data
            for (const record of chunk) {
                const ownerName = record.owner_name.trim()
                if (!uniqueShareholders.has(ownerName)) {
                    uniqueShareholders.set(ownerName, uuidv4())
                }
                const shareholderId = uniqueShareholders.get(ownerName)

                // Insert or update shareholder
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

                // Insert property
                await db.insert(properties).values({
                    account: record.account,
                    numOf: record.num_of,
                    customerName: record.customer_name,
                    customerMailingAddress: record.customer_mailing_address,
                    cityStateZip: record.city_state_zip,
                    ownerName: record.owner_name,
                    ownerMailingAddress: record.owner_mailing_address,
                    ownerCityStateZip: record.owner_city_state_zip,
                    residentName: record.resident_name,
                    residentMailingAddress: record.resident_mailing_address,
                    residentCityStateZip: record.resident_city_state_zip,
                    serviceAddress: record.service_address,
                    shareholderId,
                })
            }

            // Send progress update
            await fetch("/api/progress", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ progress, processedCount, totalRecords }),
            })
        }

        // Update meeting total shareholders
        await db
            .update(meetings)
            .set({ totalShareholders: uniqueShareholders.size })
            .where(eq(meetings.id, Number.parseInt(meetingId)))

        await logToFile("upload", "✅ File upload process completed successfully")

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${totalRecords} records`,
            totalRecords,
            totalShareholders: uniqueShareholders.size,
        })
    } catch (error) {
        await logToFile("upload", `❌ Error uploading file: ${error}`)
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }
}