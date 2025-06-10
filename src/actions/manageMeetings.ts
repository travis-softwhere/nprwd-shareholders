"use server"

import { query, queryOne } from "@/lib/db"
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

        const result = await queryOne<{
            id: number;
            year: number;
            date: Date;
            total_shareholders: number;
            checked_in: number;
            data_source: string;
            has_initial_data: boolean;
            mailers_generated: boolean;
            mailer_generation_date: Date | null;
            created_at: Date;
        }>(
            `INSERT INTO meetings (year, date, data_source)
             VALUES ($1, $2, $3)
             RETURNING id, year, date, total_shareholders, checked_in, data_source, has_initial_data, mailers_generated, mailer_generation_date, created_at`,
            [year, date, dataSource]
        )

        if (!result) {
            return { success: false, error: "Failed to create meeting" }
        }

        revalidatePath("/admin")
        return {
            success: true,
            meeting: {
                ...result,
                id: result.id.toString(),
                date: result.date.toISOString(),
                totalShareholders: result.total_shareholders ?? 0,
                checkedIn: result.checked_in ?? 0,
                dataSource: result.data_source as "excel" | "database",
                hasInitialData: result.has_initial_data ?? false,
                mailersGenerated: result.mailers_generated ?? false,
                mailerGenerationDate: result.mailer_generation_date ? result.mailer_generation_date.toISOString() : null,
                createdAt: result.created_at?.toISOString() ?? new Date().toISOString(),
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

        const existingShareholders = await query<{
            shareholder_id: string;
        }>(
            'SELECT shareholder_id FROM shareholders WHERE meeting_id = $1',
            [id]
        )

        if (existingShareholders.length > 0) {
            const shareholderIds = existingShareholders.map((s) => s.shareholder_id)
            await query(
                'DELETE FROM properties WHERE shareholder_id = ANY($1)',
                [shareholderIds]
            )
            await query(
                'DELETE FROM shareholders WHERE meeting_id = $1',
                [id]
            )
        }

        await query(
            'DELETE FROM meetings WHERE id = $1',
            [Number(id)]
        )

        revalidatePath("/admin")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete meeting",
        }
    }
}