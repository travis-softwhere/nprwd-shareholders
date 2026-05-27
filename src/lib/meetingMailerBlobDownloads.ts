/** Client helpers for mailer PDFs: Vercel Blob in production, `mailers/{meetingId}/` on disk in local dev. */

export interface MeetingMailerPdf {
    url: string
    fileName: string
}

export async function listMeetingBlobPdfs(meetingId: string): Promise<MeetingMailerPdf[]> {
    const response = await fetch(`/api/generated-pdfs?meetingId=${encodeURIComponent(meetingId)}`)
    if (!response.ok) throw new Error("Failed to load PDF list")
    const data = (await response.json()) as { pdfs?: MeetingMailerPdf[] }
    const pdfs = data.pdfs
    return Array.isArray(pdfs) ? pdfs : []
}

export async function listLocalMeetingPdfs(meetingId: string): Promise<MeetingMailerPdf[]> {
    const response = await fetch(
        `/api/generate-local-pdfs?meetingId=${encodeURIComponent(meetingId)}`,
    )
    if (!response.ok) throw new Error("Failed to load local PDF list")
    const data = (await response.json()) as { pdfs?: MeetingMailerPdf[] }
    const pdfs = data.pdfs
    return Array.isArray(pdfs) ? pdfs : []
}

export async function listMeetingMailerPdfs(
    meetingId: string,
    isLocalMode: boolean,
): Promise<MeetingMailerPdf[]> {
    return isLocalMode ? listLocalMeetingPdfs(meetingId) : listMeetingBlobPdfs(meetingId)
}

export async function downloadMailerPdfToDisk(pdf: MeetingMailerPdf): Promise<void> {
    const response = await fetch(pdf.url)
    if (!response.ok) throw new Error(`Could not download ${pdf.fileName}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = pdf.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
}

/** @deprecated use downloadMailerPdfToDisk */
export async function downloadBlobPdfToDisk(pdf: MeetingMailerPdf): Promise<void> {
    return downloadMailerPdfToDisk(pdf)
}

/**
 * Downloads all mailer batch PDFs: one ZIP when there are multiple (browser-safe),
 * or the single PDF directly when there is only one.
 */
export async function downloadAllMeetingMailerPdfs(
    meetingId: string,
    isLocalMode: boolean,
): Promise<number> {
    const pdfs = await listMeetingMailerPdfs(meetingId, isLocalMode)
    if (pdfs.length === 0) {
        return 0
    }

    if (pdfs.length === 1) {
        await downloadMailerPdfToDisk(pdfs[0])
        return 1
    }

    const storage = isLocalMode ? "local" : "blob"
    const response = await fetch(
        `/api/meeting-mailers-zip?meetingId=${encodeURIComponent(meetingId)}&storage=${storage}`,
        { credentials: "include" },
    )

    if (!response.ok) {
        let message = `Download failed (${response.status})`
        try {
            const data = (await response.json()) as { error?: string }
            if (data.error) message = data.error
        } catch {
            /* ignore */
        }
        throw new Error(message)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = `meeting-${meetingId}-mailers.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)

    return pdfs.length
}

/** @deprecated use downloadAllMeetingMailerPdfs(meetingId, isLocalMode) */
export async function downloadAllMeetingBlobPdfs(meetingId: string): Promise<number> {
    return downloadAllMeetingMailerPdfs(meetingId, false)
}
