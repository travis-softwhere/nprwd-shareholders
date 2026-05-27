import { generateMeetingMailersPdf, type MailerBatchShareholder } from "@/lib/mailerBatchPdfGeneration"
import {
    MAILER_MAX_BATCH_BYTES_DEFAULT,
    MAILER_PDF_MAX_BATCH_BYTES,
} from "@/lib/mailerGenerationConstants"

/**
 * Representative owner row so measured bytes match real overlays (barcode, wrapped address).
 * Slightly long strings avoid underestimating vs. wide names or addresses.
 */
const SAMPLE_MAILER: MailerBatchShareholder[] = [
    {
        shareholderId: "12-345678",
        name: "Representative A. Shareholder Name Junior",
        ownerMailingAddress: "1234 Sample Boulevard, Suite 500, Building North Wing",
        ownerCityStateZip: "Minot, ND 58701-1234",
    },
]

let cachedBytesPerMailer: number | null = null

/** Reference max PDF size used for estimates (historically ~32 MiB “viewer comfort” cap when outputs were split). */
export function getConfiguredMaxBatchPdfBytes(): number {
    return MAILER_MAX_BATCH_BYTES_DEFAULT
}

/**
 * Bytes for one mailer (single overlay sheet + barcode/address), measured once per process.
 */
export async function getMeasuredBytesPerMailer(): Promise<number> {
    if (cachedBytesPerMailer !== null) {
        return cachedBytesPerMailer
    }
    const { pdfBytes } = await generateMeetingMailersPdf(SAMPLE_MAILER)
    const n = pdfBytes.byteLength
    cachedBytesPerMailer = n >= 1024 ? n : 1024
    return cachedBytesPerMailer
}

/**
 * How many mailer pages fit in one output PDF under {@link MAILER_PDF_MAX_BATCH_BYTES}, based on a
 * measured single-owner PDF (template + overlay — reflects current `Production1.pdf`).
 */
export async function getPagesPerMailerBatch(): Promise<{
    pagesPerBatch: number
    bytesPerMailer: number
    maxMailerFileBytes: number
}> {
    const maxMailerFileBytes = MAILER_PDF_MAX_BATCH_BYTES
    const bytesPerMailer = await getMeasuredBytesPerMailer()
    if (!bytesPerMailer || bytesPerMailer <= 0) {
        return { pagesPerBatch: 200, bytesPerMailer: 0, maxMailerFileBytes }
    }
    const pagesPerBatch = Math.max(1, Math.floor(maxMailerFileBytes / bytesPerMailer))
    return { pagesPerBatch, bytesPerMailer, maxMailerFileBytes }
}

export type MailerOutputSizingEstimate = {
    bytesPerMailer: number
    maxBatchBytes: number
}

/**
 * Bytes-per-mailer measurement plus configured reference max size (for tooling / disk UI).
 */
export async function getMailerOutputSizingEstimate(): Promise<MailerOutputSizingEstimate> {
    const maxBatchBytes = getConfiguredMaxBatchPdfBytes()
    try {
        const bytesPerMailer = await getMeasuredBytesPerMailer()
        return { bytesPerMailer, maxBatchBytes }
    } catch {
        return { bytesPerMailer: 0, maxBatchBytes }
    }
}

export type MailerBatchSizingJson = {
    bytesPerMailer: number
    maxBatchBytes: number
    pagesPerBatch: number
    maxMailerFileBytes: number
    maxMailerFileGiB: number
}

/** Values for API / client: disk estimate fields plus dynamic pages-per-file under the 2.5 GiB cap. */
export async function getMailerBatchSizingForApi(): Promise<MailerBatchSizingJson> {
    const base = await getMailerOutputSizingEstimate()
    const { pagesPerBatch, maxMailerFileBytes, bytesPerMailer } = await getPagesPerMailerBatch()
    return {
        bytesPerMailer: base.bytesPerMailer || bytesPerMailer,
        maxBatchBytes: base.maxBatchBytes,
        pagesPerBatch,
        maxMailerFileBytes,
        maxMailerFileGiB: Math.round((maxMailerFileBytes / 1024 ** 3) * 100) / 100,
    }
}
