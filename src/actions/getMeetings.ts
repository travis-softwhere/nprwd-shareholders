"use server"

import { db } from "@/lib/db"
import { meetings } from "@/lib/db/schema"
import type { Meeting } from "@/types/meeting"

export async function getMeetings(): Promise<Meeting[]> {
    try {
        const result = await db.select().from(meetings)
        return result.map((meeting) => ({
            id: meeting.id.toString(),
            year: meeting.year,
            date: meeting.date.toISOString(),
            totalShareholders: meeting.totalShareholders ?? 0,
            checkedIn: meeting.checkedIn ?? 0,
            dataSource: meeting.dataSource as "excel" | "database",
            hasInitialData: meeting.hasInitialData ?? false,
            mailersGenerated: meeting.mailersGenerated ?? false,
            mailerGenerationDate: meeting.mailerGenerationDate ? meeting.mailerGenerationDate.toISOString() : null,
            createdAt: meeting.createdAt?.toISOString() ?? new Date().toISOString(),
        }))
    } catch (error) {
        console.error("Error fetching meetings:", error)
        throw error
    }
}