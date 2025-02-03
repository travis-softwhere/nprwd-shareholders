"use server"

import { db } from "@/lib/db"
import { meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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
            },
        }
    } catch (error) {
        console.error("Error creating meeting:", error)
        return { success: false, error: "Failed to create meeting" }
    }
}

export async function deleteMeeting(formData: FormData) {
    try {
        const id = Number.parseInt(formData.get("id") as string)

        if (!id || isNaN(id)) {
            throw new Error("Invalid meeting ID")
        }

        await db.delete(meetings).where(eq(meetings.id, id))

        revalidatePath("/admin")
        return { success: true }
    } catch (error) {
        console.error("Error deleting meeting:", error)
        return { success: false, error: "Failed to delete meeting" }
    }
}