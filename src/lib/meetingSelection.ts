import type { Meeting } from "@/types/meeting"

/** Most recent annual meeting (highest year, then latest date, then highest id). */
export function getLatestMeeting(meetings: Meeting[]): Meeting | null {
    if (meetings.length === 0) return null
    return [...meetings].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        const dateB = new Date(b.date).getTime()
        const dateA = new Date(a.date).getTime()
        if (dateB !== dateA) return dateB - dateA
        return Number(b.id) - Number(a.id)
    })[0]
}

/** Stored active meeting when set; otherwise the latest meeting in the list. */
export function resolveActiveMeeting(meetings: Meeting[], storedId: string | null): Meeting | null {
    if (meetings.length === 0) return null
    if (storedId) {
        const preferred = meetings.find((m) => String(m.id) === String(storedId))
        if (preferred) return preferred
    }
    return getLatestMeeting(meetings)
}
