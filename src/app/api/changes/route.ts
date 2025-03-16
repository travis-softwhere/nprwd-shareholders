import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { snapshots } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"


export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const meetingId = searchParams.get("meetingId")

        if (!meetingId) {
           
            return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
        }

      
        // Get the latest two snapshots to compare
        const latestSnapshots = await db
            .select()
            .from(snapshots)
            .where(eq(snapshots.meetingId, meetingId))
            .orderBy(desc(snapshots.createdAt))
            .limit(2)

        if (latestSnapshots.length < 2) {
            
            return NextResponse.json({ changes: [] })
        }

        const [current, previous] = latestSnapshots
        
        

        return NextResponse.json({
            changes: current.changes || [],
            snapshotDate: current.snapshotDate,
        })
    } catch (error) {
        
        return NextResponse.json({ error: "Failed to fetch changes" }, { status: 500 })
    }
}