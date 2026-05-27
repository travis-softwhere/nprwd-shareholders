import { PDFDocument } from "pdf-lib"
import fs from "fs/promises"
import { mailerBatchPdfFileName } from "@/lib/mailerBatchConstants"
import { appendMailerCopyWithProductionOverlay } from "@/lib/mailerPdfOverlay"
import { resolveMailerTemplatePath } from "@/lib/mailerPdfConstants"
import { canonicalShareholderId } from "@/lib/meetingScopedShareholderId"

export type MailerBatchShareholder = {
    shareholderId: string
    /** When set, barcode text uses `{meetingId}-{shareholderId}`. */
    meetingId?: string
    name: string
    ownerMailingAddress: string
    ownerCityStateZip: string
}

export { mailerBatchPdfFileName } from "@/lib/mailerBatchConstants"

/**
 * One PDF containing one overlay page per shareholder (template registration sheet only).
 * @param options.fileName — defaults to {@link mailerBatchPdfFileName}(1) for sizing probes with one sample row.
 */
export async function generateMeetingMailersPdf(
    shareholders: MailerBatchShareholder[],
    options?: { fileName?: string },
): Promise<{ fileName: string; pdfBytes: Uint8Array }> {
    console.log(`\nStarting PDF generation for ${shareholders.length} shareholder(s)`)

    const templatePath = resolveMailerTemplatePath()
    const templateBytes = await fs.readFile(templatePath)
    const pdfDoc = await PDFDocument.create()
    const templateDoc = await PDFDocument.load(templateBytes)

    let processedCount = 0
    for (const shareholder of shareholders) {
        try {
            const barcodeShareholderId = shareholder.meetingId
                ? canonicalShareholderId(shareholder.shareholderId, shareholder.meetingId)
                : shareholder.shareholderId
            await appendMailerCopyWithProductionOverlay(pdfDoc, templateDoc, {
                shareholderId: barcodeShareholderId,
                name: shareholder.name || "",
                ownerMailingAddress: shareholder.ownerMailingAddress || "",
                ownerCityStateZip: shareholder.ownerCityStateZip || "",
            })

            processedCount++
            if (processedCount % 50 === 0) {
                console.log(
                    `Mailer PDF progress: ${processedCount}/${shareholders.length} (${Math.round((processedCount / shareholders.length) * 100)}%)`,
                )
            }
        } catch (error) {
            console.error(`Error processing shareholder ${shareholder.shareholderId}:`, error)
        }
    }

    const pdfBytes = await pdfDoc.save()
    const fileName = options?.fileName ?? mailerBatchPdfFileName(1)

    console.log(`Completed mailer PDF: ${processedCount}/${shareholders.length} shareholders processed`)

    return { fileName, pdfBytes }
}
