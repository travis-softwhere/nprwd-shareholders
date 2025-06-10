"use server"

import { queryOne } from "@/lib/db"

export async function clearShareholderDesignee(shareholderId: string): Promise<string | null> {
    try {
        const result = await queryOne<{ designee: string | null }>(
            'UPDATE shareholders SET designee = NULL WHERE shareholder_id = $1 RETURNING designee',
            [shareholderId]
        );

        return result?.designee ?? null;
    } catch (error) {
        console.error("Failed to clear shareholder designee:", error)
        return null
    }
} 