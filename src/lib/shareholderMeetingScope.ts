import { db } from "@/lib/db"
import { meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * DB values that can appear in `shareholders.meeting_id` for a given annual meeting.
 * Legacy imports stored the calendar year ("2025") instead of the meetings PK ("1").
 *
 * When only one meeting exists for that calendar year, we also match `meeting_id = year`
 * so legacy rows appear for that meeting.
 *
 * When multiple meetings share the same year (e.g. two "2025" annuals on different dates),
 * we only match the canonical PK. Legacy `meeting_id = '2025'` then matches **no** single-meeting
 * filter until rows are updated to the correct numeric id — otherwise every meeting’s query would
 * include the same legacy rows.
 */
export async function shareholderMeetingIdVariantsForFilter(meetingIdParam: string): Promise<string[]> {
    const mid = meetingIdParam.trim()
    const pk = parseInt(mid, 10)
    if (Number.isNaN(pk)) {
        return [mid]
    }

    const rows = await db
        .select({ id: meetings.id, year: meetings.year })
        .from(meetings)
        .where(eq(meetings.id, pk))
        .limit(1)

    if (rows.length === 0) {
        return [mid]
    }

    const row = rows[0]
    const othersSameYear = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.year, row.year))

    const ids = new Set<string>([String(row.id)])
    if (othersSameYear.length === 1) {
        ids.add(String(row.year))
    }
    return Array.from(ids)
}
