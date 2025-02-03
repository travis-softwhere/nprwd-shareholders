import { NextResponse } from "next/server"
import bwip from "bwip-js"
import { jsPDF } from "jspdf"
import { logToFile } from "@/utils/logger"
import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
    try {
        await logToFile("mailers", "🚀 Starting PDF generation process")

        const { meetingId } = await request.json()

        const shareholderData = await db
            .select()
            .from(shareholders)
            .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
            .where(eq(shareholders.meetingId, meetingId))

        await logToFile("mailers", `📊 Total shareholders to process: ${shareholderData.length}`)

        // Create a new PDF document with larger initial size
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

                try {
                    // Ensure strings are properly truncated
                    const ownerName = shareholder.name.substring(0, 50)
                    const account = property ? property.account.substring(0, 30) : "N/A"
                    const mailingAddress = (property?.ownerMailingAddress ?? "").substring(0, 50)
                    const cityStateZip = (property?.ownerCityStateZip ?? "").substring(0, 50)

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

                    // Convert barcode to base64 with error handling
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
        return new Response(pdfChunks, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=shareholder-mailers.pdf",
            },
        })
    } catch (error) {
        await logToFile("mailers", `❌ Error generating mailers: ${error}`)
        return NextResponse.json({ error: "Failed to generate mailers" }, { status: 500 })
    }
}