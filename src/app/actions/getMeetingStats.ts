"use server"

import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, count, gt, sql } from "drizzle-orm"

export async function getMeetingStats() {
    const now = new Date()

    const [shareholderStats, nextMeeting] = await Promise.all([
        db
            .select({
                totalShareholders: count(shareholders.id),
                checkedInCount: sql<number>`COUNT(CASE WHEN ${properties.checkedIn} = true THEN 1 END)`.as("checkedInCount"),
            })
            .from(shareholders)
            .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
            .then((result) => result[0]),

        db
            .select()
            .from(meetings)
            .where(gt(meetings.date, now))
            .orderBy(meetings.date)
            .limit(1)
            .then((results) => results[0]),
    ])

    return {
        totalShareholders: shareholderStats?.totalShareholders ?? 0,
        checkedInCount: Number(shareholderStats?.checkedInCount) ?? 0,
        nextMeeting,
    }
}