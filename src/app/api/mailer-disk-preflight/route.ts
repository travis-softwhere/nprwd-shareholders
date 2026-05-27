import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getMailerDiskPreflightReport } from "@/lib/mailerDiskSpacePreflight"

export const dynamic = "force-dynamic"

/** Admin: estimated mailer output size vs free disk space for local `mailers/` generation. */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get("meetingId")?.trim() ?? ""
    if (!meetingId || meetingId.includes("..") || /[/\\]/.test(meetingId)) {
        return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 })
    }

    try {
        const report = await getMailerDiskPreflightReport(meetingId)
        return NextResponse.json(report)
    } catch (e) {
        console.error("mailer-disk-preflight:", e)
        return NextResponse.json({ error: "Failed to analyze disk space" }, { status: 500 })
    }
}
