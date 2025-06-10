"use server"

import { queryOne } from "@/lib/db"

export async function setShareholderDesignee(shareholderId: string, designee: string): Promise<string | null> {
    try {
        const result = await queryOne<{ designee: string | null }>(
            'UPDATE shareholders SET designee = $1 WHERE shareholder_id = $2 RETURNING designee',
            [designee, shareholderId]
        );

        return result?.designee ?? null;
    } catch (error) {
        console.error("Failed to set shareholder designee:", error)
        return null
    }
} 