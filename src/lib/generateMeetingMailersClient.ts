/** Client-side batch mailer generation (calls `/api/print-mailers` or `/api/generate-local-pdfs`). */

export const MAILER_BATCH_SIZE = 50

function extractZipCode(cityStateZip: string | undefined): string {
    if (!cityStateZip) return ""
    const match = cityStateZip.match(/\d{5}(?:-\d{4})?$/)
    return match ? match[0] : ""
}

export type MeetingMailerProgress = {
    mailerProgress: number
    currentBatchNumber: number
    totalBatches: number
    currentBatchStatus: string
    currentBatchShareholderCount: number
}

/**
 * Clears prior blobs for the meeting, then generates PDF batches for all shareholders (ZIP-sorted).
 */
export async function generateMeetingMailerBatches(
    meetingId: string,
    options: {
        isLocalMode: boolean
        onProgress: (p: Partial<MeetingMailerProgress>) => void
    },
): Promise<{ batchCount: number }> {
    const { isLocalMode, onProgress } = options

    const clearEndpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/generated-pdfs"
    await fetch(clearEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
    })

    const shareholdersRes = await fetch(`/api/shareholders?meetingId=${encodeURIComponent(meetingId)}`)
    if (!shareholdersRes.ok) throw new Error("Failed to fetch shareholders")
    const shareholdersData = await shareholdersRes.json()
    const allShareholders = shareholdersData.shareholders
    if (!Array.isArray(allShareholders) || allShareholders.length === 0) {
        throw new Error("No shareholders found for this meeting")
    }

    allShareholders.sort((a: { ownerCityStateZip?: string; cityStateZip?: string }, b: typeof a) => {
        const zipA = extractZipCode(a.ownerCityStateZip || a.cityStateZip || "")
        const zipB = extractZipCode(b.ownerCityStateZip || b.cityStateZip || "")
        return zipA.localeCompare(zipB)
    })

    const totalBatchesCalc = Math.ceil(allShareholders.length / MAILER_BATCH_SIZE)
    onProgress({ totalBatches: totalBatchesCalc })

    const endpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/print-mailers"
    let batchCount = 0

    for (let i = 0; i < allShareholders.length; i += MAILER_BATCH_SIZE) {
        const batchNumber = Math.floor(i / MAILER_BATCH_SIZE) + 1
        const rawBatch = allShareholders.slice(i, i + MAILER_BATCH_SIZE)
        const batch = rawBatch.map((sh: Record<string, unknown>) => ({
            ...sh,
            ownerMailingAddress: sh.ownerMailingAddress || "",
            ownerCityStateZip: sh.ownerCityStateZip || "",
        }))

        onProgress({
            currentBatchNumber: batchNumber,
            currentBatchShareholderCount: rawBatch.length,
            currentBatchStatus: "Generating PDF...",
            mailerProgress: Math.round(((batchNumber - 1) / totalBatchesCalc) * 95),
        })

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId, batchNumber, batch }),
        })

        onProgress({ currentBatchStatus: "Uploading PDF..." })

        if (!res.ok) {
            onProgress({ currentBatchStatus: "Error" })
            throw new Error(`Failed to generate PDF for batch ${batchNumber}`)
        }

        onProgress({ currentBatchStatus: "Completed" })
        await res.json()
        batchCount += 1
        await new Promise((r) => setTimeout(r, 300))
    }

    onProgress({
        mailerProgress: 100,
        currentBatchStatus: "All batches completed",
    })

    return { batchCount }
}
