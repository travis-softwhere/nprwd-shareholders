import fs from "fs/promises"
import { PDFDocument } from "pdf-lib"
import { appendMailerCopyWithProductionOverlay, TEST_MAILER_OVERLAY_FIELDS } from "@/lib/mailerPdfOverlay"
import { resolveMailerTemplatePath } from "@/lib/mailerPdfConstants"

/** Single-page proof PDF using the current template + {@link TEST_MAILER_OVERLAY_FIELDS}. Server-only. */
export async function buildTestMailerPdf(): Promise<Uint8Array> {
    const templatePath = resolveMailerTemplatePath()
    const templateBytes = await fs.readFile(templatePath)
    const pdfDoc = await PDFDocument.create()
    const templateDoc = await PDFDocument.load(templateBytes)
    await appendMailerCopyWithProductionOverlay(pdfDoc, templateDoc, TEST_MAILER_OVERLAY_FIELDS)
    return pdfDoc.save()
}
