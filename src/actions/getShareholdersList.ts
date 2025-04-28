"use server"

import { db } from "@/lib/db"
import { shareholders as shareholdersTable, properties } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import type { ShareholdersListResponse, Shareholder } from "@/types/shareholder"

export async function getShareholdersList(
    page: number = 1,
    itemsPerPage: number = 25
): Promise<ShareholdersListResponse> {
    const offset = (page - 1) * itemsPerPage

    try {
        const shareholders = await db
            .select({
                id: shareholdersTable.id,
                name: shareholdersTable.name,
                shareholderId: shareholdersTable.shareholderId,
                isNew: shareholdersTable.isNew,
                totalProperties: sql<number>`count(${shareholdersTable.id})`.mapWith(Number),
                checkedInProperties: sql<number>`count(case when properties.checked_in then 1 else null end)`.mapWith(Number)
            })
            .from(shareholdersTable)
            .leftJoin(properties, eq(shareholdersTable.shareholderId, properties.shareholderId))
            .groupBy(shareholdersTable.id)
            .limit(itemsPerPage)
            .offset(offset)

        const totalResult = await db.select({ count: sql<number>`count(*)` }).from(shareholdersTable)
        const totalShareholders = totalResult[0]?.count || 0

        const typedShareholders = shareholders as Shareholder[]

        return {
            shareholders: typedShareholders,
            totalShareholders,
        }
    } catch (error) {
        console.error("Failed to fetch shareholders list:", error)
        return { shareholders: [], totalShareholders: 0 }
    }
}