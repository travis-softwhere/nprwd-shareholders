import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { snapshots } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            await logToFile("changes", "Unauthorized changes access attempt", LogLevel.WARN);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const meetingId = searchParams.get("meetingId")

        if (!meetingId) {
            await logToFile("changes", "Missing meeting ID in changes request", LogLevel.WARN);
            return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
        }

        await logToFile("changes", "Fetching changes for meeting", LogLevel.INFO, {
            meetingId
        });

        // Get the latest two snapshots to compare
        const latestSnapshots = await db
            .select()
            .from(snapshots)
            .where(eq(snapshots.meetingId, meetingId))
            .orderBy(desc(snapshots.createdAt))
            .limit(2)

        if (latestSnapshots.length < 2) {
            await logToFile("changes", "Insufficient snapshots for comparison", LogLevel.INFO, {
                snapshotsFound: latestSnapshots.length
            });
            return NextResponse.json({ changes: [] })
        }

        const [current, previous] = latestSnapshots
        
        await logToFile("changes", "Changes fetched successfully", LogLevel.INFO, {
            changeCount: current.changes ? (Array.isArray(current.changes) ? current.changes.length : 1) : 0,
            snapshotDate: current.snapshotDate
        });

        return NextResponse.json({
            changes: current.changes || [],
            snapshotDate: current.snapshotDate,
        })
    } catch (error) {
        await logToFile("changes", "Error fetching changes", LogLevel.ERROR, {
            errorType: error instanceof Error ? error.name : "Unknown error type",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json({ error: "Failed to fetch changes" }, { status: 500 })
    }
}