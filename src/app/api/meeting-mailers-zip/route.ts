import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { list } from "@vercel/blob"
import archiver from "archiver"
import { PassThrough, Readable } from "node:stream"
import fs from "fs/promises"
import path from "path"
import { createReadStream } from "node:fs"
import { resolveLocalMailersMeetingDir } from "@/lib/mailerLocalDiskPaths"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Streams a single ZIP of mailer PDF(s) for a meeting (Blob storage or local `mailers/{id}/`).
 * One download avoids browsers blocking multiple programmatic file downloads.
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get("meetingId")?.trim()
    const storage = searchParams.get("storage")?.trim() ?? "blob"

    if (!meetingId || meetingId.includes("..") || /[/\\]/.test(meetingId)) {
        return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 })
    }

    if (storage !== "blob" && storage !== "local") {
        return NextResponse.json({ error: "Invalid storage" }, { status: 400 })
    }

    const resolvedDir = resolveLocalMailersMeetingDir(meetingId)

    type BlobRow = Awaited<ReturnType<typeof list>>["blobs"][number]
    let blobs: BlobRow[] | null = null
    let localPdfNames: string[] | null = null

    if (storage === "blob") {
        const listed = await list({ prefix: `mailers/${meetingId}/` })
        blobs = listed.blobs
        if (!blobs.length) {
            return NextResponse.json({ error: "No PDFs in storage for this meeting" }, { status: 404 })
        }
    } else {
        let entries: string[] = []
        try {
            entries = await fs.readdir(resolvedDir)
        } catch {
            return NextResponse.json({ error: "No local PDFs for this meeting" }, { status: 404 })
        }
        const pdfs = entries.filter((f) => f.toLowerCase().endsWith(".pdf")).sort()
        if (!pdfs.length) {
            return NextResponse.json({ error: "No PDF files found" }, { status: 404 })
        }
        localPdfNames = pdfs
    }

    const archive = archiver("zip", { zlib: { level: 6 } })
    const pass = new PassThrough()

    archive.on("error", (err: Error) => {
        pass.destroy(err)
    })

    archive.pipe(pass)

    void (async () => {
        try {
            if (storage === "local" && localPdfNames) {
                for (const f of localPdfNames) {
                    const full = path.resolve(path.join(resolvedDir, f))
                    const rel = path.relative(resolvedDir, full)
                    if (rel.startsWith("..") || path.isAbsolute(rel)) {
                        continue
                    }
                    archive.append(createReadStream(full), { name: f })
                }
            } else if (blobs) {
                for (let i = 0; i < blobs.length; i++) {
                    const blob = blobs[i]
                    const res = await fetch(blob.url)
                    if (!res.ok || !res.body) {
                        continue
                    }
                    const name =
                        blob.pathname.split("/").pop() || `mailers-${i + 1}.pdf`
                    // DOM vs Node ReadableStream typings differ; Node accepts the fetch body stream.
                    archive.append(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), {
                        name,
                    })
                }
            }
            await archive.finalize()
        } catch (e) {
            archive.abort()
            pass.destroy(e instanceof Error ? e : new Error(String(e)))
        }
    })()

    const webStream = Readable.toWeb(pass)

    return new NextResponse(webStream as BodyInit, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="meeting-${meetingId}-mailers.zip"`,
            "Cache-Control": "no-store",
        },
    })
}
