/** Client-side mailer generation: batched PDFs to project `mailers/{meetingId}/` (dev) or Blob (prod). */

export type MeetingMailerProgress = {
    mailerProgress: number
    /** True while the server builds a PDF segment — no live % until that request finishes. */
    mailerProgressIndeterminate?: boolean
    currentBatchNumber: number
    totalBatches: number
    currentBatchStatus: string
    currentBatchShareholderCount: number
    /** Dev: absolute directory where batch PDFs were written */
    lastLocalPath?: string
}

async function downloadPdfFromBlobUrl(fileUrl: string, downloadAsFileName: string): Promise<void> {
    const pdfResponse = await fetch(fileUrl)
    if (!pdfResponse.ok) throw new Error(`Could not fetch PDF from storage (${pdfResponse.status})`)
    const blob = await pdfResponse.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = downloadAsFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new DOMException("Mailer generation cancelled", "AbortError")
    }
}

function extractZipCode(cityStateZip: string | undefined): string {
    if (!cityStateZip) return ""
    const match = cityStateZip.match(/\d{5}(?:-\d{4})?$/)
    return match ? match[0] : ""
}

function chunkShareholders<T>(rows: T[], chunkSize: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < rows.length; i += chunkSize) {
        out.push(rows.slice(i, i + chunkSize))
    }
    return out
}

/**
 * Clears prior blobs or local `mailers/{id}/`, then generates invitation PDFs in parts sized from the server
 * (~2.5 GiB per file from measured bytes per mailer page — template + overlay).
 */
export async function generateMeetingMailers(
    meetingId: string,
    options: {
        isLocalMode: boolean
        signal?: AbortSignal
        onProgress: (p: Partial<MeetingMailerProgress>) => void
    },
): Promise<{ lastLocalPath?: string }> {
    const { isLocalMode, onProgress, signal } = options

    throwIfAborted(signal)

    const clearEndpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/generated-pdfs"
    await fetch(clearEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
        signal,
    })

    throwIfAborted(signal)

    const sizingRes = await fetch("/api/mailer-batch-estimate", {
        credentials: "include",
        signal,
    })
    if (!sizingRes.ok) throw new Error("Failed to fetch mailer batch sizing")
    const sizingJson = (await sizingRes.json()) as { pagesPerBatch?: number }
    const pagesPerBatch =
        typeof sizingJson.pagesPerBatch === "number" && sizingJson.pagesPerBatch > 0
            ? sizingJson.pagesPerBatch
            : 200

    const shareholdersRes = await fetch(`/api/shareholders?meetingId=${encodeURIComponent(meetingId)}`, {
        signal,
    })
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

    const batch = allShareholders.map((sh: Record<string, unknown>) => ({
        ...sh,
        ownerMailingAddress: sh.ownerMailingAddress || "",
        ownerCityStateZip: sh.ownerCityStateZip || "",
    }))

    const chunks = chunkShareholders(batch, pagesPerBatch)
    const totalParts = chunks.length

    let lastLocalPath: string | undefined

    for (let part = 0; part < chunks.length; part++) {
        throwIfAborted(signal)

        const partNumber = part + 1
        const slice = chunks[part]

        onProgress({
            totalBatches: totalParts,
            currentBatchNumber: partNumber,
            currentBatchShareholderCount: slice.length,
            currentBatchStatus: `Generating PDF ${partNumber} of ${totalParts} (≤${pagesPerBatch} pages per file, ~2.5 GiB cap)…`,
            mailerProgressIndeterminate: true,
            mailerProgress: totalParts <= 1 ? 0 : Math.round((part / totalParts) * 85),
        })

        const endpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/print-mailers"

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                meetingId,
                batch: slice,
                partNumber,
                totalParts,
            }),
            signal,
        })

        if (!res.ok) {
            onProgress({ currentBatchStatus: "Error", mailerProgressIndeterminate: false })
            let msg = "Failed to generate mailer PDF"
            try {
                const ct = res.headers.get("content-type") ?? ""
                if (ct.includes("application/json")) {
                    const j = (await res.json()) as { error?: string }
                    if (j.error) msg = j.error
                }
            } catch {
                /* ignore */
            }
            throw new Error(msg)
        }

        if (isLocalMode) {
            const data = (await res.json()) as {
                success?: boolean
                meetingDir?: string
                path?: string
                fileName?: string
            }
            if (data.meetingDir) {
                lastLocalPath = data.meetingDir
            } else if (data.path) {
                lastLocalPath = data.path.replace(/[/\\][^/\\]+\.pdf$/i, "")
            }
            onProgress({
                currentBatchStatus: `Saved ${data.fileName ?? `part ${partNumber}`}`,
                mailerProgressIndeterminate: false,
                mailerProgress: Math.round(((part + 1) / totalParts) * 95),
                lastLocalPath,
            })
        } else {
            const data = (await res.json()) as {
                success?: boolean
                url?: string
                fileName?: string
            }

            if (data.url && data.fileName) {
                onProgress({
                    currentBatchStatus:
                        totalParts === 1
                            ? "Downloading PDF…"
                            : `Uploaded ${data.fileName} (${partNumber}/${totalParts})`,
                    mailerProgressIndeterminate: false,
                    mailerProgress: Math.round(((part + 1) / totalParts) * 95),
                })
                if (totalParts === 1) {
                    try {
                        await downloadPdfFromBlobUrl(data.url, data.fileName)
                    } catch {
                        onProgress({
                            currentBatchStatus:
                                "PDF stored online — open Generated PDFs on Overview if download failed",
                            mailerProgress: 100,
                        })
                    }
                }
            }
        }
    }

    onProgress({
        mailerProgress: 100,
        mailerProgressIndeterminate: false,
        currentBatchStatus: "Done",
        lastLocalPath,
    })

    return { lastLocalPath }
}
