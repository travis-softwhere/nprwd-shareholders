"use server"

import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Update the createMeeting function to ensure dataSource is correctly typed
export async function createMeeting(formData: FormData) {
    try {
        const year = Number.parseInt(formData.get("year") as string)
        const date = new Date(formData.get("date") as string)
        const dataSource = formData.get("dataSource") as "excel" | "database"

        if (!year || isNaN(year) || !date || isNaN(date.getTime()) || !dataSource) {
            throw new Error("Invalid year, date, or data source")
        }

        const result = await db
            .insert(meetings)
            .values({
                year,
                date,
                dataSource,
            })
            .returning({
                id: meetings.id,
                year: meetings.year,
                date: meetings.date,
                totalShareholders: meetings.totalShareholders,
                checkedIn: meetings.checkedIn,
                dataSource: meetings.dataSource,
                hasInitialData: meetings.hasInitialData,
                mailersGenerated: meetings.mailersGenerated,
                mailerGenerationDate: meetings.mailerGenerationDate,
                createdAt: meetings.createdAt,
            })

        revalidatePath("/admin")
        return {
            success: true,
            meeting: {
                ...result[0],
                id: result[0].id.toString(),
                date: result[0].date.toISOString(),
                totalShareholders: result[0].totalShareholders ?? 0,
                checkedIn: result[0].checkedIn ?? 0,
                dataSource: result[0].dataSource as "excel" | "database",
                hasInitialData: result[0].hasInitialData ?? false,
                mailersGenerated: result[0].mailersGenerated ?? false,
                mailerGenerationDate: result[0].mailerGenerationDate?.toISOString() ?? null,
                createdAt: result[0].createdAt?.toISOString() ?? new Date().toISOString(),
            },
        }
    } catch (error) {
        return { success: false, error: "Failed to create meeting" }
    }
}

export async function deleteMeeting(formData: FormData) {
    try {
        const id = formData.get("id") as string
        if (!id) throw new Error("Meeting ID is required")

        const existingShareholders = await db
            .select({ shareholderId: shareholders.shareholderId })
            .from(shareholders)
            .where(eq(shareholders.meetingId, id))

        if (existingShareholders.length > 0) {
            const shareholderIds = existingShareholders.map((s) => s.shareholderId)
            await db.delete(properties).where(inArray(properties.shareholderId, shareholderIds))
            await db.delete(shareholders).where(eq(shareholders.meetingId, id))
        }

        await db.delete(meetings).where(eq(meetings.id, Number(id)))

        revalidatePath("/admin")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete meeting",
        }
    }
}