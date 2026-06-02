import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { properties, shareholders } from "@/lib/db/schema"
import { inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { logToFile, LogLevel } from "@/utils/logger"

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        if (!session.user.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        let body: { meetingId?: string } = {}
        try {
            body = await request.json()
        } catch {
            /* empty body */
        }
        const meetingIdParam = body.meetingId?.trim()
        if (!meetingIdParam) {
            return NextResponse.json(
                { error: "meetingId is required (uncheck-in is per meeting only)" },
                { status: 400 },
            )
        }

        const variants = await shareholderMeetingIdVariantsForFilter(meetingIdParam)

        const shareholderRows = await db
            .select({ shareholderId: shareholders.shareholderId })
            .from(shareholders)
            .where(inArray(shareholders.meetingId, variants))

        const ids = shareholderRows.map((s) => s.shareholderId)
        let propertyCount = 0
        if (ids.length > 0) {
            const updated = await db
                .update(properties)
                .set({
                    checkedIn: false,
                    signatureImage: null,
                    signatureHash: null,
                    checkedInAt: null,
                })
                .where(inArray(properties.shareholderId, ids))
                .returning({ id: properties.id })
            propertyCount = updated.length
        }

        const clearedShareholders = await db
            .update(shareholders)
            .set({
                checkedIn: false,
                checkedInAt: null,
                signatureImage: null,
                signatureHash: null,
            })
            .where(inArray(shareholders.meetingId, variants))
            .returning({ shareholderId: shareholders.shareholderId })

        await logToFile("properties", "Meeting-scoped bulk uncheck-in completed", LogLevel.INFO, {
            meetingId: meetingIdParam,
            propertyRowsUpdated: propertyCount,
            shareholdersCleared: clearedShareholders.length,
        })

        return NextResponse.json({
            message: "Properties and check-in data cleared for this meeting",
            updatedCount: propertyCount,
            shareholdersCleared: clearedShareholders.length,
        })
    } catch (error) {
        await logToFile("properties", "Error in bulk uncheck-in operation", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
        })

        return NextResponse.json(
            { error: "Failed to process bulk uncheck-in operation" },
            { status: 500 },
        )
    }
}
