import type { Meeting } from "@/types/meeting"

/** Admin list-all mode: value that means “do not narrow rows by meeting”. */
export const ADMIN_MEETING_FILTER_ALL = "__all__"

/**
 * Resolve a shareholder row’s `meetingId` to a meeting record.
 * Handles legacy data where `meeting_id` was stored as the calendar year (e.g. "2025")
 * instead of the meetings table primary key (e.g. "1").
 */
export function resolveMeetingFromShareholderMeetingId(
    raw: string | null | undefined,
    meetings: Meeting[],
): Meeting | undefined {
    if (raw == null || raw === "") return undefined
    const s = String(raw).trim()
    const byId = meetings.find((x) => String(x.id) === s)
    if (byId) return byId
    if (/^\d{4}$/.test(s)) {
        const year = parseInt(s, 10)
        const sameYear = meetings.filter((x) => x.year === year)
        if (sameYear.length === 1) return sameYear[0]
        return undefined
    }
    return undefined
}

export function shareholderMatchesMeetingFilter(
    shareholderMeetingId: string | null | undefined,
    filterMeetingId: string,
    meetings: Meeting[],
): boolean {
    const filterM = meetings.find((x) => String(x.id) === String(filterMeetingId))
    if (!filterM) return true
    const resolved = resolveMeetingFromShareholderMeetingId(shareholderMeetingId, meetings)
    if (!resolved) {
        return String(shareholderMeetingId) === String(filterMeetingId)
    }
    return String(resolved.id) === String(filterM.id)
}

export function formatMeetingLabel(m: Meeting): string {
    const dateShort = new Date(m.date).toLocaleDateString()
    return `${m.year} Annual · ${dateShort}`
}
