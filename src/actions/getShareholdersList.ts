"use server"

import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function getShareholdersList(page: number, itemsPerPage: number) {
    const offset = (page - 1) * itemsPerPage

    const [shareholdersList, totalCount] = await Promise.all([
        db
            .select({
                id: shareholders.id,
                name: shareholders.name,
                shareholderId: shareholders.shareholderId,
                totalProperties: sql<number>`count(${properties.id})`.as("totalProperties"),
                checkedInProperties: sql<number>`sum(case when ${properties.checkedIn} then 1 else 0 end)`.as(
                    "checkedInProperties",
                ),
            })
            .from(shareholders)
            .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
            .groupBy(shareholders.id)
            .limit(itemsPerPage)
            .offset(offset),

        db
            .select({ count: sql<number>`count(*)` })
            .from(shareholders)
            .then((result) => result[0].count),
    ])

    return {
        shareholders: shareholdersList,
        totalShareholders: totalCount,
    }
}