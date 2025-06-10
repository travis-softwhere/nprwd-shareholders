"use server"

import { query, queryOne } from "@/lib/db"
import type { Meeting } from "@/types/meeting"

export async function getMeetings(): Promise<Meeting[]> {
    try {
        const result = await query<{
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
        }>('SELECT * FROM meetings');

        return result.map((meeting) => ({
            id: meeting.id.toString(),
            year: meeting.year,
            date: meeting.date.toISOString(),
            totalShareholders: meeting.total_shareholders ?? 0,
            checkedIn: meeting.checked_in ?? 0,
            dataSource: meeting.data_source as "excel" | "database",
            hasInitialData: meeting.has_initial_data ?? false,
            mailersGenerated: meeting.mailers_generated ?? false,
            mailerGenerationDate: meeting.mailer_generation_date ? meeting.mailer_generation_date.toISOString() : null,
            createdAt: meeting.created_at?.toISOString() ?? new Date().toISOString(),
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
        const meeting = await queryOne<{
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
            'SELECT * FROM meetings WHERE id = $1',
            [parseInt(id, 10)]
        );
        
        if (!meeting) {
            return null;
        }
        
        return {
            id: meeting.id.toString(),
            year: meeting.year,
            date: meeting.date.toISOString(),
            totalShareholders: meeting.total_shareholders ?? 0,
            checkedIn: meeting.checked_in ?? 0,
            dataSource: meeting.data_source as "excel" | "database",
            hasInitialData: meeting.has_initial_data ?? false,
            mailersGenerated: meeting.mailers_generated ?? false,
            mailerGenerationDate: meeting.mailer_generation_date ? meeting.mailer_generation_date.toISOString() : null,
            createdAt: meeting.created_at?.toISOString() ?? new Date().toISOString(),
        }
    } catch (error) {
        // Let error bubble up to caller
        throw error
    }
}