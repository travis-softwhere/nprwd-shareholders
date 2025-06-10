"use server"

import { queryOne } from "@/lib/db"

export async function getShareholderDesignee(shareholderId: string): Promise<string | null> {
    try {
        const result = await queryOne<{ designee: string | null }>(
            'SELECT designee FROM shareholders WHERE shareholder_id = $1',
            [shareholderId]
        );

        return result?.designee ?? null;
    } catch (error) {
        console.error("Failed to fetch shareholder designee:", error)
        return null
    }
} 