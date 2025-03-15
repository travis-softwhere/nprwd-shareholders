"use server"

import { db } from "@/lib/db"
import { meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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
        // Remove console.error for production
        throw error
    }
}

/**
 * Retrieves a meeting by ID
 */
export async function getMeetingById(id: string): Promise<Meeting | null> {
    try {
        const result = await db.select().from(meetings).where(eq(meetings.id, parseInt(id, 10))).limit(1)
        
        if (result.length === 0) {
            return null
        }
        
        const meeting = result[0]
        return {
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
        }
    } catch (error) {
        // Let error bubble up to caller
        throw error
    }
}