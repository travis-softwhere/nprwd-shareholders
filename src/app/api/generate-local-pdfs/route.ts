import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createReadStream } from "fs"
import fs from "fs/promises"
import path from "path"
import { Readable } from "stream"
import {
    generateMeetingMailersPdf,
    type MailerBatchShareholder,
} from "@/lib/mailerBatchPdfGeneration"
import { mailerBatchPdfFileName } from "@/lib/mailerBatchConstants"
import { getPagesPerMailerBatch } from "@/lib/mailerBatchSizing"
import { canonicalShareholderId } from "@/lib/meetingScopedShareholderId"
import { resolveLocalMailersMeetingDir } from "@/lib/mailerLocalDiskPaths"

/** List or download mailer PDFs under `mailers/{meetingId}/`. */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const meetingId = searchParams.get("meetingId")?.trim()
        const fileNameRaw = searchParams.get("file")?.trim()

        if (!meetingId || meetingId.includes("..") || /[/\\]/.test(meetingId)) {
            return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 })
        }

        const resolvedDir = resolveLocalMailersMeetingDir(meetingId)

        if (fileNameRaw) {
            const safe = path.basename(fileNameRaw)
            if (!/^[\w.-]+\.pdf$/i.test(safe)) {
                return NextResponse.json({ error: "Invalid file name" }, { status: 400 })
            }
            const pdfPath = path.resolve(path.join(resolvedDir, safe))
            const rel = path.relative(resolvedDir, pdfPath)
            if (rel.startsWith("..") || path.isAbsolute(rel)) {
                return NextResponse.json({ error: "Invalid path" }, { status: 400 })
            }
            try {
                const st = await fs.stat(pdfPath)
                const nodeStream = createReadStream(pdfPath)
                const webStream = Readable.toWeb(nodeStream) as unknown as BodyInit
                return new NextResponse(webStream, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/pdf",
                        "Content-Length": String(st.size),
                        "Content-Disposition": `attachment; filename="${encodeURIComponent(safe)}"`,
                        "Cache-Control": "no-store",
                    },
                })
            } catch {
                return NextResponse.json({ error: "File not found" }, { status: 404 })
            }
        }

        let entries: string[] = []
        try {
            entries = await fs.readdir(resolvedDir)
        } catch {
            return NextResponse.json({ pdfs: [] as { fileName: string; url: string }[] })
        }

        const base = "/api/generate-local-pdfs"
        const pdfs = entries
            .filter((f) => f.toLowerCase().endsWith(".pdf"))
            .sort()
            .map((fileName) => ({
                fileName,
                url: `${base}?meetingId=${encodeURIComponent(meetingId)}&file=${encodeURIComponent(fileName)}`,
            }))

        return NextResponse.json({ pdfs })
    } catch (error) {
        console.error("Error in GET generate-local-pdfs:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await request.json()
        const { meetingId, batch, partNumber: partNumberRaw } = body

        if (!meetingId || typeof meetingId !== "string" || !batch) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }
        if (!Array.isArray(batch)) {
            return NextResponse.json({ error: "Invalid batch" }, { status: 400 })
        }
        const { pagesPerBatch } = await getPagesPerMailerBatch()
        if (batch.length > pagesPerBatch) {
            return NextResponse.json(
                {
                    error: `Each request may include at most ${pagesPerBatch} owners (one mailer page each; ~2.5 GiB cap per file).`,
                },
                { status: 400 },
            )
        }
        const partNumber =
            typeof partNumberRaw === "number" && Number.isFinite(partNumberRaw) && partNumberRaw >= 1
                ? Math.floor(partNumberRaw)
                : typeof partNumberRaw === "string" && /^\d+$/.test(partNumberRaw.trim())
                  ? Math.max(1, parseInt(partNumberRaw.trim(), 10))
                  : 1
        const fileName = mailerBatchPdfFileName(partNumber)

        const normalizedBatch: MailerBatchShareholder[] = (batch as MailerBatchShareholder[]).map(
            (row) => ({
                ...row,
                meetingId: row.meetingId ?? meetingId,
                shareholderId: canonicalShareholderId(
                    String(row.shareholderId),
                    String(row.meetingId ?? meetingId),
                ),
            }),
        )

        const { fileName: generatedName, pdfBytes } = await generateMeetingMailersPdf(normalizedBatch, {
            fileName,
        })

        const resolvedDir = resolveLocalMailersMeetingDir(meetingId)
        await fs.mkdir(resolvedDir, { recursive: true })

        const pdfPath = path.join(resolvedDir, generatedName)
        await fs.writeFile(pdfPath, pdfBytes)

        console.log(
            `Wrote local mailer PDF ${generatedName} (${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB) → ${pdfPath}`,
        )

        return NextResponse.json({
            success: true,
            path: pdfPath,
            meetingDir: resolvedDir,
            fileName: generatedName,
            size: pdfBytes.length,
            partNumber,
        })
    } catch (error) {
        console.error("Error generating local PDF:", error)
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
        if (code === "ENOSPC") {
            return NextResponse.json(
                {
                    error:
                        "Disk full — could not save this PDF. Free space on the drive that contains the project mailers/ folder (Admin → Generate invitation PDFs shows an estimate first), then retry.",
                    code: "ENOSPC",
                },
                { status: 507 },
            )
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 },
        )
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await request.json()
        const { meetingId } = body

        if (!meetingId) {
            return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
        }

        const dir = resolveLocalMailersMeetingDir(meetingId)
        try {
            await fs.rm(dir, { recursive: true, force: true })
        } catch {
            console.log("Local mailers directory already deleted or missing")
        }

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("Error deleting local PDFs:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
