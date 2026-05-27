"use server"

import { db } from "@/lib/db"
import { meetings, shareholders, properties } from "@/lib/db/schema"
import { eq, count, gt, sql, inArray, and } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"

export async function getMeetingStats(meetingId?: string | null) {
    const now = new Date()

    const meetingVariants = meetingId
        ? await shareholderMeetingIdVariantsForFilter(meetingId)
        : null

    const meetingWhere = meetingVariants
        ? inArray(shareholders.meetingId, meetingVariants)
        : undefined

    const [shareholderRow] = await db
        .select({ totalShareholders: count(shareholders.id) })
        .from(shareholders)
        .where(meetingWhere)

    const propertyStatsQuery = db
        .select({
            totalProperties: count(properties.id),
            checkedInProperties: sql<number>`SUM(CASE WHEN ${properties.checkedIn} = true THEN 1 ELSE 0 END)`.as(
                "checkedInProperties",
            ),
        })
        .from(properties)
        .innerJoin(shareholders, eq(properties.shareholderId, shareholders.shareholderId))
        .where(meetingWhere)

    const [propertyRow] = await propertyStatsQuery

    const checkedInOwnersQuery = db
        .select({
            checkedInShareholders: sql<number>`COUNT(DISTINCT ${shareholders.shareholderId})`.as(
                "checkedInShareholders",
            ),
        })
        .from(shareholders)
        .innerJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
        .where(
            meetingWhere
                ? and(meetingWhere, eq(properties.checkedIn, true))
                : eq(properties.checkedIn, true),
        )

    const [checkedInOwnerRow] = await checkedInOwnersQuery

    const [nextMeeting] = await db
        .select()
        .from(meetings)
        .where(gt(meetings.date, now))
        .orderBy(meetings.date)
        .limit(1)

    const totalShareholders = shareholderRow?.totalShareholders ?? 0
    const totalProperties = propertyRow?.totalProperties ?? 0
    const checkedInProperties = Number(propertyRow?.checkedInProperties) ?? 0
    const checkedInShareholders = Number(checkedInOwnerRow?.checkedInShareholders) ?? 0

    return {
        totalShareholders,
        totalProperties,
        /** Checked-in property rows (benefit units / votes). */
        checkedInCount: checkedInProperties,
        checkedInProperties,
        /** Owners with at least one checked-in property. */
        checkedInShareholders,
        nextMeeting,
    }
}
