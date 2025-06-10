"use server"

import { query, queryOne } from "@/lib/db"

export async function getMeetingStats() {
    const now = new Date()

    const [shareholderStats, nextMeeting] = await Promise.all([
        queryOne<{
            totalShareholders: number;
            checkedInCount: number;
        }>(
            `SELECT 
                COUNT(DISTINCT s.id) as "totalShareholders",
                COUNT(CASE WHEN p.checked_in = true THEN 1 END) as "checkedInCount"
            FROM shareholders s
            LEFT JOIN properties p ON s.shareholder_id = p.shareholder_id`
        ),

        queryOne<{
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
            'SELECT * FROM meetings WHERE date > $1 ORDER BY date LIMIT 1',
            [now]
        )
    ])

    return {
        totalShareholders: shareholderStats?.totalShareholders ?? 0,
        checkedInCount: Number(shareholderStats?.checkedInCount) ?? 0,
        nextMeeting,
    }
}