import bwip from "bwip-js"
import type { PDFFont } from "pdf-lib"
import { PDFDocument, StandardFonts } from "pdf-lib"
import {
    MAILER_OVERLAY_PAGE_INDEX,
    MAILER_OVERLAY_PAGE_NUMBER,
    MAILER_TEMPLATE_FILE_NAME,
} from "@/lib/mailerPdfConstants"

function breakLongWord(word: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    const lines: string[] = []
    let chunk = ""
    for (const ch of word) {
        const next = chunk + ch
        if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
            chunk = next
        } else {
            if (chunk) lines.push(chunk)
            chunk = ch
        }
    }
    if (chunk) lines.push(chunk)
    return lines
}

/** Word-wrap to a max width; preserves words, breaks only when a single word exceeds width. */
function wrapTextToLines(
    text: string,
    maxWidth: number,
    font: PDFFont,
    fontSize: number,
): string[] {
    const t = text.trim()
    if (!t) return []
    const words = t.split(/\s+/)
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
        if (font.widthOfTextAtSize(w, fontSize) > maxWidth) {
            if (cur) {
                lines.push(cur)
                cur = ""
            }
            lines.push(...breakLongWord(w, maxWidth, font, fontSize))
            continue
        }
        const next = cur ? `${cur} ${w}` : w
        if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
            cur = next
        } else {
            if (cur) lines.push(cur)
            cur = w
        }
    }
    if (cur) lines.push(cur)
    return lines
}

/** Fields written on the mailer overlay (production blob layout). */
export type MailerOverlayFields = {
    shareholderId: string
    name: string
    ownerMailingAddress: string
    ownerCityStateZip: string
}

/** Sample data for layout checks only — not real owners or meetings. */
export const TEST_MAILER_OVERLAY_FIELDS: MailerOverlayFields = {
    shareholderId: "12-345678",
    name: "Sample A. Shareholder",
    ownerMailingAddress: "123 Example Street, Suite 100",
    ownerCityStateZip: "Minot, ND 58701",
}

/**
 * Appends **only** the invitation sheet that carries barcode + address (source template page
 * {@link MAILER_OVERLAY_PAGE_NUMBER}) — copies that single page — then draws the overlay in the
 * **left mailing panel** (ledger‑landscape `Production1.pdf`): barcode’s left edge on the panel
 * midline, address centered below.
 */
export async function appendMailerCopyWithProductionOverlay(
    pdfDoc: PDFDocument,
    templateDoc: PDFDocument,
    fields: MailerOverlayFields,
): Promise<void> {
    const { shareholderId, name, ownerMailingAddress, ownerCityStateZip } = fields

    const barcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
        bwip.toBuffer(
            {
                bcid: "code128",
                text: shareholderId,
                scale: 2.95,
                height: 14,
                includetext: true,
                textxalign: "center",
            },
            (err: Error | null, png: Buffer) => {
                if (err) reject(err)
                else resolve(png)
            },
        )
    })

    const templatePageCount = templateDoc.getPageCount()
    if (templatePageCount < 1) {
        throw new Error(`${MAILER_TEMPLATE_FILE_NAME} has no pages`)
    }
    if (MAILER_OVERLAY_PAGE_INDEX >= templatePageCount) {
        throw new Error(
            `${MAILER_TEMPLATE_FILE_NAME} has ${templatePageCount} page(s); overlay targets page ${MAILER_OVERLAY_PAGE_NUMBER} ` +
                `(index ${MAILER_OVERLAY_PAGE_INDEX}). Adjust MAILER_OVERLAY_PAGE_NUMBER in mailerPdfConstants.ts if the template changed.`,
        )
    }

    const pageIndexBeforeThisMailer = pdfDoc.getPageCount()
    const copied = await pdfDoc.copyPages(templateDoc, [MAILER_OVERLAY_PAGE_INDEX])
    copied.forEach((page) => pdfDoc.addPage(page))

    /** Single page per mailer — overlay is drawn on the page we just appended */
    const overlayPageIndex = pageIndexBeforeThisMailer
    const page = pdfDoc.getPage(overlayPageIndex)
    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)
    const barcodeDims = barcodeImage.scale(0.76)
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const mailingFontSize = 13
    const lineHeight = mailingFontSize * 1.38
    /**
     * Ledger/tabloid landscape `Production1.pdf` (1224×792): mailing art is the **left half**.
     * Barcode **left edge** sits on the **horizontal center** of that panel; address lines are
     * **centered** in the panel below the barcode.
     */
    const mailPanelWidth = width / 2
    /** Horizontal inset from panel edges for wrapped address lines (symmetric centering). */
    const mailPanelAddressInset = 44
    const maxTextWidth = mailPanelWidth - 2 * mailPanelAddressInset
    /** Points from the physical top of the page down to the top edge of the barcode image. */
    const barcodeTopOffsetFromPageTop = 88
    /**
     * Address block is anchored from the page bottom so moving the barcode up **opens vertical space**
     * between barcode and text instead of sliding the address with it.
     */
    const ADDRESS_FIRST_LINE_FROM_PAGE_BOTTOM = 206
    /** Minimum space between bottom of barcode graphic and first address baseline (PDF y increases upward). */
    const minGapBarcodeBottomToFirstBaseline = 32
    /** Keep last address line above agenda / lower banners in the left column. */
    const minRecipientBaselineY = 330

    const barcodeWidth = barcodeDims.width
    const barcodeHeight = barcodeDims.height
    /** Left edge of barcode aligned with the vertical midline of the mailing panel. */
    const barcodeX = mailPanelWidth / 2

    const addressLines: string[] = [
        ...wrapTextToLines(name || "", maxTextWidth, font, mailingFontSize),
        ...wrapTextToLines(ownerMailingAddress, maxTextWidth, font, mailingFontSize),
        ...wrapTextToLines(ownerCityStateZip, maxTextWidth, font, mailingFontSize),
    ].filter((s) => s.length > 0)

    if (addressLines.length === 0) {
        return
    }

    const n = addressLines.length

    let firstBaseline = height - ADDRESS_FIRST_LINE_FROM_PAGE_BOTTOM
    let lastBaseline = firstBaseline - (n - 1) * lineHeight
    if (lastBaseline < minRecipientBaselineY) {
        const bump = minRecipientBaselineY - lastBaseline
        firstBaseline += bump
        lastBaseline += bump
    }

    const barcodeTopY = height - barcodeTopOffsetFromPageTop
    let barcodeY = barcodeTopY - barcodeHeight
    if (barcodeY < firstBaseline + minGapBarcodeBottomToFirstBaseline) {
        barcodeY = firstBaseline + minGapBarcodeBottomToFirstBaseline
    }

    page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: barcodeHeight,
    })

    for (let i = 0; i < addressLines.length; i++) {
        const line = addressLines[i]
        const yBaseline = firstBaseline - i * lineHeight
        const textWidth = font.widthOfTextAtSize(line, mailingFontSize)
        const x = (mailPanelWidth - textWidth) / 2
        page.drawText(line, {
            x,
            y: yBaseline,
            size: mailingFontSize,
            font,
        })
    }
}
