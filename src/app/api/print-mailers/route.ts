import { NextResponse } from "next/server"
import bwip from "bwip-js"
import { jsPDF } from "jspdf"
import { logToFile } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await logToFile("mailers", "🚀 Starting PDF generation process")

        // Log all incoming headers for debugging
        const headers = Object.fromEntries(request.headers.entries())
        await logToFile("mailers", `📨 Incoming headers: ${JSON.stringify(headers)}`)

        // Safely parse the request body with content type check
        const contentType = request.headers.get("content-type")
        if (!contentType) {
            await logToFile("mailers", "❌ Missing content type header")
            return NextResponse.json({ error: "Content-Type header is required" }, { status: 400 })
        }

        if (!contentType.toLowerCase().includes("application/json")) {
            await logToFile("mailers", `❌ Invalid content type: ${contentType}`)
            return NextResponse.json(
                { error: `Invalid content type. Expected application/json but got ${contentType}` },
                { status: 400 },
            )
        }

        let meetingId: string
        try {
            const body = await request.json()
            meetingId = body.meetingId

            if (!meetingId) {
                throw new Error("Meeting ID is required")
            }
        } catch (error) {
            await logToFile("mailers", `❌ Invalid request body: ${error}`)
            return NextResponse.json({ error: "Invalid request body. Expected { meetingId: string }" }, { status: 400 })
        }

        // Validate meeting ID format
        if (typeof meetingId !== "string") {
            await logToFile("mailers", "❌ Invalid meeting ID format")
            return NextResponse.json({ error: "Invalid meeting ID format" }, { status: 400 })
        }

        const shareholderData = await db
            .select()
            .from(shareholders)
            .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
            .where(eq(shareholders.meetingId, meetingId))

        if (!shareholderData.length) {
            await logToFile("mailers", "⚠️ No shareholders found for the given meeting ID")
            return NextResponse.json({ error: "No shareholders found for the given meeting ID" }, { status: 404 })
        }

        await logToFile("mailers", `📊 Total shareholders to process: ${shareholderData.length}`)

        // Create a new PDF document
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "letter",
        })

        let currentY = 50
        let processedCount = 0

        // Process shareholders in smaller chunks
        const chunkSize = 25
        for (let i = 0; i < shareholderData.length; i += chunkSize) {
            const chunk = shareholderData.slice(i, i + chunkSize)
            await logToFile("mailers", `📄 Processing PDF chunk ${i + 1} to ${i + chunk.length} of ${shareholderData.length}`)

            for (const data of chunk) {
                const { shareholders: shareholder, properties: property } = data
                if (!shareholder) continue

                try {
                    // Ensure strings are properly truncated and handle nulls
                    const ownerName = shareholder.name?.substring(0, 50) || "N/A"
                    const account = property?.account?.substring(0, 30) || "N/A"
                    const mailingAddress = property?.ownerMailingAddress?.substring(0, 50) || ""
                    const cityStateZip = property?.ownerCityStateZip?.substring(0, 50) || ""

                    // Generate barcode
                    const barcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
                        bwip.toBuffer(
                            {
                                bcid: "code128",
                                text: shareholder.shareholderId,
                                scale: 2,
                                height: 10,
                                includetext: true,
                                textxalign: "center",
                            },
                            (err: Error | null, png: Buffer) => {
                                if (err) reject(err)
                                else resolve(png)
                            },
                        )
                    })

                    // Convert barcode to base64
                    const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString("base64")}`

                    // Add content to PDF with proper spacing
                    doc.setFontSize(14)
                    doc.text(ownerName, doc.internal.pageSize.width / 2, currentY, { align: "center" })

                    currentY += 20
                    doc.setFontSize(10)
                    doc.text(`Account: ${account}`, 50, currentY)

                    currentY += 20
                    doc.addImage(barcodeBase64, "PNG", 50, currentY, 150, 30)

                    currentY += 40
                    doc.text("Mailing Address:", 50, currentY)

                    currentY += 15
                    if (mailingAddress) {
                        doc.text(mailingAddress, 50, currentY)
                    }

                    currentY += 15
                    if (cityStateZip) {
                        doc.text(cityStateZip, 50, currentY)
                    }

                    processedCount++
                    await logToFile("mailers", `✓ Processed shareholder ${processedCount} of ${shareholderData.length}`)

                    // Add new page if not the last record
                    if (processedCount < shareholderData.length) {
                        doc.addPage()
                        currentY = 50 // Reset Y position for new page
                    }
                } catch (error) {
                    await logToFile("mailers", `❌ Error processing shareholder ${shareholder.shareholderId}: ${error}`)
                    continue
                }
            }

            // Save progress periodically
            if (i % 100 === 0) {
                await logToFile("mailers", `💾 Saving progress after ${processedCount} records...`)
            }
        }

        // Generate PDF in chunks
        await logToFile("mailers", "📑 Generating final PDF...")
        const pdfChunks = doc.output("arraybuffer")

        // Create response with chunked data
        await logToFile("mailers", "✅ PDF generation complete!")

        // Use Response constructor for better control over headers
        return new Response(pdfChunks, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=shareholder-mailers.pdf",
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        await logToFile("mailers", `❌ Error generating mailers: ${error}`)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to generate mailers",
            },
            { status: 500 },
        )
    }
}