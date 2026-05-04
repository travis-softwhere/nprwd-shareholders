import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"

/** Admin: remove all benefit unit owners (and their properties) for one annual meeting. */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json().catch(() => ({}))
        const meetingId = typeof body?.meetingId === "string" ? body.meetingId.trim() : ""
        if (!meetingId) {
            return NextResponse.json({ error: "meetingId is required" }, { status: 400 })
        }

        const variants = await shareholderMeetingIdVariantsForFilter(meetingId)

        const rows = await db
            .select({ shareholderId: shareholders.shareholderId })
            .from(shareholders)
            .where(inArray(shareholders.meetingId, variants))

        const shareholderIds = rows.map((r) => r.shareholderId)
        let deletedProperties = 0
        let deletedShareholders = 0

        if (shareholderIds.length > 0) {
            const propDel = await db
                .delete(properties)
                .where(inArray(properties.shareholderId, shareholderIds))
                .returning({ id: properties.id })
            deletedProperties = propDel.length

            const shDel = await db
                .delete(shareholders)
                .where(inArray(shareholders.meetingId, variants))
                .returning({ shareholderId: shareholders.shareholderId })
            deletedShareholders = shDel.length
        }

        const meetingPk = Number.parseInt(meetingId, 10)
        if (!Number.isNaN(meetingPk)) {
            const [row] = await db
                .select({ id: meetings.id })
                .from(meetings)
                .where(eq(meetings.id, meetingPk))
                .limit(1)
            if (row) {
                await db
                    .update(meetings)
                    .set({ totalShareholders: 0, checkedIn: 0 })
                    .where(eq(meetings.id, meetingPk))
            }
        }

        return NextResponse.json({
            success: true,
            deletedShareholders,
            deletedProperties,
        })
    } catch (error) {
        console.error("clear-for-meeting:", error)
        return NextResponse.json({ error: "Failed to clear shareholders for meeting" }, { status: 500 })
    }
}
