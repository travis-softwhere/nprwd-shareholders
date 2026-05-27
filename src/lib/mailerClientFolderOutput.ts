/**
 * Browser File System Access API helpers for writing mailer PDFs to a user-picked folder
 * (e.g. external drive). Server receives no path — PDF bytes are returned and saved client-side.
 */

const DIR_PICKER_ID = "nprwd-mailers-output"

export function mailerFolderPickerSupported(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window
}

/** Opens the system folder picker; creates the same `mailers/{meetingId}/` layout under the chosen root. */
export async function pickMailerOutputRootFolder(
    startIn?: FileSystemDirectoryHandle | null,
): Promise<FileSystemDirectoryHandle | null> {
    if (!mailerFolderPickerSupported()) {
        return null
    }
    try {
        const handle = await window.showDirectoryPicker({
            id: DIR_PICKER_ID,
            mode: "readwrite",
            ...(startIn ? { startIn } : {}),
        })
        return handle
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
            return null
        }
        throw e
    }
}

/** Removes `mailers/{meetingId}/` under the chosen root before a fresh generation run. */
export async function clearMeetingMailersOnClient(
    rootHandle: FileSystemDirectoryHandle,
    meetingId: string,
): Promise<void> {
    const safeId = meetingId.trim()
    if (!safeId || safeId.includes("/") || safeId.includes("\\")) return
    try {
        const mailers = await rootHandle.getDirectoryHandle("mailers")
        await mailers.removeEntry(safeId, { recursive: true })
    } catch {
        /* missing path is fine */
    }
}

async function resolveMailerMeetingFileWritable(
    rootHandle: FileSystemDirectoryHandle,
    meetingId: string,
    fileName: string,
): Promise<FileSystemWritableFileStream> {
    const safeId = meetingId.trim()
    if (!safeId || safeId.includes("/") || safeId.includes("\\")) {
        throw new Error("Invalid meeting id")
    }
    const safeFile = fileName.replace(/[/\\]/g, "")
    if (!/^[\w.-]+\.pdf$/i.test(safeFile)) {
        throw new Error("Invalid file name")
    }
    const mailersDir = await rootHandle.getDirectoryHandle("mailers", { create: true })
    const meetingDir = await mailersDir.getDirectoryHandle(safeId, { create: true })
    const fh = await meetingDir.getFileHandle(safeFile, { create: true })
    return fh.createWritable()
}

export type StreamMailerPdfOptions = {
    /** From `X-Mailers-File-Size`; if set, we verify bytes on disk match (catches silent pipe/write failures). */
    expectedBytes?: number
}

/**
 * Streams the PDF response body to disk without loading the whole file into RAM.
 * Uses explicit read/write instead of `pipeTo`: Chromium + File System Access API can finish with a 0-byte file
 * when piping a large fetch body into `createWritable()` in some cases.
 */
export async function streamMailerPdfToClientFolder(
    rootHandle: FileSystemDirectoryHandle,
    meetingId: string,
    fileName: string,
    stream: ReadableStream<Uint8Array>,
    options?: StreamMailerPdfOptions,
): Promise<void> {
    const writable = await resolveMailerMeetingFileWritable(rootHandle, meetingId, fileName)
    const writer = writable.getWriter()
    const reader = stream.getReader()
    let written = 0
    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (value?.byteLength) {
                await writer.write(value)
                written += value.byteLength
            }
        }
        await writer.close()
    } catch (e) {
        try {
            await writer.abort()
        } catch {
            /* ignore */
        }
        throw e
    }

    if (written === 0) {
        throw new Error(
            "No PDF bytes arrived in the browser (0 B written). The dev server may not have streamed the response — try “This project” mode so the API writes mailers.pdf next to the repo, or retry.",
        )
    }

    const expected = options?.expectedBytes
    if (expected != null && Number.isFinite(expected) && expected > 0 && written !== expected) {
        throw new Error(
            `PDF stream ended at ${written} bytes but server reported ${expected} bytes — file may be incomplete. Retry or save via “This project” instead.`,
        )
    }
}

/** Writes one mailer PDF under `root/mailers/{meetingId}/{fileName}` from a Blob (small PDFs only). */
export async function writeMailerBatchPdfToClientFolder(
    rootHandle: FileSystemDirectoryHandle,
    meetingId: string,
    fileName: string,
    blob: Blob,
): Promise<void> {
    const w = await resolveMailerMeetingFileWritable(rootHandle, meetingId, fileName)
    await w.write(blob)
    await w.close()
}
