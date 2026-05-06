"use server"

import { db } from "@/lib/db"
import { appSettings, meetings, shareholders, properties, snapshots } from "@/lib/db/schema"
import { ACTIVE_MEETING_SETTING_KEY } from "@/lib/appSettingsKeys"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"

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

export async function updateMeeting(formData: FormData) {
    try {
        const id = (formData.get("id") as string | null)?.trim() ?? ""
        const year = Number.parseInt(formData.get("year") as string, 10)
        const date = new Date(formData.get("date") as string)
        const dataSource = formData.get("dataSource") as "excel" | "database"

        if (!id) {
            return { success: false, error: "Meeting id is required" as const }
        }
        if (!year || Number.isNaN(year) || !date || Number.isNaN(date.getTime())) {
            return { success: false, error: "Invalid year or date" as const }
        }
        if (dataSource !== "excel" && dataSource !== "database") {
            return { success: false, error: "Invalid data source" as const }
        }

        const pk = Number.parseInt(id, 10)
        if (Number.isNaN(pk)) {
            return { success: false, error: "Invalid meeting id" as const }
        }

        const result = await db
            .update(meetings)
            .set({ year, date, dataSource })
            .where(eq(meetings.id, pk))
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

        const row = result[0]
        if (!row) {
            return { success: false, error: "Meeting not found" as const }
        }

        const meeting = {
            id: row.id.toString(),
            year: row.year,
            date: row.date.toISOString(),
            totalShareholders: row.totalShareholders ?? 0,
            checkedIn: row.checkedIn ?? 0,
            dataSource: row.dataSource as "excel" | "database",
            hasInitialData: row.hasInitialData ?? false,
            mailersGenerated: row.mailersGenerated ?? false,
            mailerGenerationDate: row.mailerGenerationDate?.toISOString() ?? null,
            createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        }

        revalidatePath("/admin")
        return { success: true as const, meeting }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update meeting",
        }
    }
}

export async function deleteMeeting(formData: FormData) {
    try {
        const id = formData.get("id") as string
        if (!id) throw new Error("Meeting ID is required")

        const meetingIdVariants = await shareholderMeetingIdVariantsForFilter(id)

        const existingShareholders = await db
            .select({ shareholderId: shareholders.shareholderId })
            .from(shareholders)
            .where(inArray(shareholders.meetingId, meetingIdVariants))

        if (existingShareholders.length > 0) {
            const shareholderIds = existingShareholders.map((s) => s.shareholderId)
            await db.delete(properties).where(inArray(properties.shareholderId, shareholderIds))
            await db.delete(shareholders).where(inArray(shareholders.meetingId, meetingIdVariants))
        }

        await db.delete(snapshots).where(inArray(snapshots.meetingId, meetingIdVariants))

        await db
            .delete(appSettings)
            .where(
                and(
                    eq(appSettings.key, ACTIVE_MEETING_SETTING_KEY),
                    eq(appSettings.value, String(Number(id))),
                ),
            )

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