"use server"

import { queryOne } from "@/lib/db"

export async function deleteProperty(id: string): Promise<boolean> {
    try {
        const result = await queryOne<{ id: number }>(
            'DELETE FROM properties WHERE id = $1 RETURNING id',
            [parseInt(id, 10)]
        );

        return result !== null;
    } catch (error) {
        console.error("Failed to delete property:", error)
        return false
    }
} 