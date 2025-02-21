"use server"

import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function createMeeting(formData: FormData) {
    try {
        const year = Number.parseInt(formData.get("year") as string)
        const date = new Date(formData.get("date") as string)

        if (!year || isNaN(year) || !date || isNaN(date.getTime())) {
            throw new Error("Invalid year or date")
        }

        const result = await db
            .insert(meetings)
            .values({
                year,
                date,
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
                dataSource: result[0].dataSource,
                hasInitialData: result[0].hasInitialData ?? false,
                mailersGenerated: result[0].mailersGenerated ?? false,
                mailerGenerationDate: result[0].mailerGenerationDate?.toISOString() ?? null,
                createdAt: result[0].createdAt?.toISOString() ?? new Date().toISOString(),
            },
        }
    } catch (error) {
        console.error("Error creating meeting:", error)
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
        console.error("Failed to delete meeting:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete meeting",
        }
    }
}