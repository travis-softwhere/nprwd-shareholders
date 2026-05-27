import { statfs } from "fs/promises"
import fs from "fs/promises"
import path from "path"
import { count, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { shareholders } from "@/lib/db/schema"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { getMeasuredBytesPerMailer } from "@/lib/mailerBatchSizing"
import { MAILER_DISK_ESTIMATE_MARGIN } from "@/lib/mailerGenerationConstants"
import { resolveLocalMailersMeetingDir } from "@/lib/mailerLocalDiskPaths"

export function formatMailerDiskBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "—"
    const units = ["B", "KB", "MB", "GB", "TB"]
    let v = bytes
    let u = 0
    while (v >= 1024 && u < units.length - 1) {
        v /= 1024
        u++
    }
    return `${u === 0 ? Math.round(v) : v.toFixed(u >= 3 ? 2 : 1)} ${units[u]}`
}

function bigintToSafeNumber(b: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER)
    if (b > max) return Number.MAX_SAFE_INTEGER
    return Number(b)
}

async function readFreeBytesForDirectory(dirPath: string): Promise<{ freeBytes: bigint } | null> {
    try {
        await fs.mkdir(dirPath, { recursive: true })
        const s = await statfs(dirPath)
        const bavail = typeof s.bavail === "bigint" ? s.bavail : BigInt(s.bavail as number)
        const bsize = typeof s.bsize === "bigint" ? s.bsize : BigInt(s.bsize as number)
        return { freeBytes: bavail * bsize }
    } catch {
        return null
    }
}

export type MailerDiskPreflightResult = {
    shareholderCount: number
    bytesPerMailer: number
    bytesPerMailerFormatted: string
    estimatedRawBytes: number
    estimatedBytesWithMargin: number
    marginPercent: number
    /** Null if the OS/API did not return free space */
    freeBytes: number | null
    /** Meeting folder under repo `mailers/` used for volume stats */
    mailersDirectory: string
    /** False = insufficient on checked volume; null = unknown */
    sufficient: boolean | null
    shortfallBytes: number | null
    /** Pre-formatted for UI */
    estimatedRawFormatted: string
    estimatedWithMarginFormatted: string
    freeFormatted: string | null
    shortfallFormatted: string | null
}

/**
 * Estimates total bytes for all invitation PDFs (~bytes per mailer × owners).
 * Compares to free space on the volume that holds the repo `mailers/` folder.
 */
export async function getMailerDiskPreflightReport(meetingId: string): Promise<MailerDiskPreflightResult> {
    const mailersDirectory = resolveLocalMailersMeetingDir(meetingId)
    const mailersParent = path.dirname(mailersDirectory)

    const variants = await shareholderMeetingIdVariantsForFilter(meetingId.trim())
    const [countRow] = await db
        .select({ n: count(shareholders.id) })
        .from(shareholders)
        .where(inArray(shareholders.meetingId, variants))

    const shareholderCount = Number(countRow?.n ?? 0)
    const bytesPerMailer = await getMeasuredBytesPerMailer()
    const estimatedRawBytes = Math.ceil(bytesPerMailer * shareholderCount)
    const estimatedBytesWithMargin = Math.ceil(estimatedRawBytes * MAILER_DISK_ESTIMATE_MARGIN)
    const marginPercent = Math.round((MAILER_DISK_ESTIMATE_MARGIN - 1) * 100)

    const freeInfo = await readFreeBytesForDirectory(mailersParent)
    const freeBytesNum = freeInfo ? bigintToSafeNumber(freeInfo.freeBytes) : null

    let sufficient: boolean | null = null
    let shortfallBytes: number | null = null

    if (freeInfo) {
        const needed = BigInt(estimatedBytesWithMargin)
        sufficient = freeInfo.freeBytes >= needed
        if (!sufficient) {
            shortfallBytes = bigintToSafeNumber(needed - freeInfo.freeBytes)
        }
    }

    return {
        shareholderCount,
        bytesPerMailer,
        bytesPerMailerFormatted: formatMailerDiskBytes(bytesPerMailer),
        estimatedRawBytes,
        estimatedBytesWithMargin,
        marginPercent,
        freeBytes: freeBytesNum,
        mailersDirectory,
        sufficient,
        shortfallBytes,
        estimatedRawFormatted: formatMailerDiskBytes(estimatedRawBytes),
        estimatedWithMarginFormatted: formatMailerDiskBytes(estimatedBytesWithMargin),
        freeFormatted: freeBytesNum !== null ? formatMailerDiskBytes(freeBytesNum) : null,
        shortfallFormatted:
            shortfallBytes !== null && shortfallBytes > 0 ? formatMailerDiskBytes(shortfallBytes) : null,
    }
}
