"use server"

import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, count, gt, sql, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"

export async function getMeetingStats(meetingId?: string | null) {
    const now = new Date()

    const meetingVariants = meetingId
        ? await shareholderMeetingIdVariantsForFilter(meetingId)
        : null

    const shareholderStatsQuery = db
        .select({
            totalShareholders: count(shareholders.id),
            checkedInCount: sql<number>`COUNT(CASE WHEN ${properties.checkedIn} = true THEN 1 END)`.as("checkedInCount"),
        })
        .from(shareholders)
        .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))

    const [shareholderStats, nextMeeting] = await Promise.all([
        (meetingId && meetingVariants
            ? shareholderStatsQuery.where(inArray(shareholders.meetingId, meetingVariants))
            : shareholderStatsQuery
        ).then((result) => result[0]),

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