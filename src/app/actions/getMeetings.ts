"use server"

import { db } from "@/lib/db"
import { meetings } from "@/lib/db/schema"

export async function getMeetings() {
    try {
        const allMeetings = await db.select().from(meetings)
        return allMeetings.map((meeting) => ({
            ...meeting,
            id: meeting.id.toString(),
            date: meeting.date.toISOString(),
            totalShareholders: meeting.totalShareholders ?? 0,
            checkedIn: meeting.checkedIn ?? 0,
        }))
    } catch (error) {
        console.error("Error fetching meetings:", error)
        // Return an empty array instead of throwing
        return []
    }
}