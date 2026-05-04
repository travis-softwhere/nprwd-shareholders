import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { count, eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"

/** Admin: preview how many rows would be removed (same scope as POST). */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const meetingId = searchParams.get("meetingId")?.trim() ?? ""
        if (!meetingId) {
            return NextResponse.json({ error: "meetingId is required" }, { status: 400 })
        }

        const variants = await shareholderMeetingIdVariantsForFilter(meetingId)

        const [shRow] = await db
            .select({ n: count(shareholders.id) })
            .from(shareholders)
            .where(inArray(shareholders.meetingId, variants))

        const [propRow] = await db
            .select({ n: count(properties.id) })
            .from(properties)
            .innerJoin(shareholders, eq(properties.shareholderId, shareholders.shareholderId))
            .where(inArray(shareholders.meetingId, variants))

        return NextResponse.json({
            shareholderCount: Number(shRow?.n ?? 0),
            propertyCount: Number(propRow?.n ?? 0),
        })
    } catch (error) {
        console.error("clear-for-meeting GET:", error)
        return NextResponse.json({ error: "Failed to load meeting data counts" }, { status: 500 })
    }
}

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
