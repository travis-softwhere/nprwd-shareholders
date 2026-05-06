"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings, meetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { ACTIVE_MEETING_SETTING_KEY } from "@/lib/appSettingsKeys"

/**
 * Public read: which meeting is the org-wide “active” one (all sessions).
 * Returns null if unset or table missing.
 */
export async function getStoredActiveMeetingId(): Promise<string | null> {
    try {
        const rows = await db
            .select({ value: appSettings.value })
            .from(appSettings)
            .where(eq(appSettings.key, ACTIVE_MEETING_SETTING_KEY))
            .limit(1)
        const v = rows[0]?.value?.trim()
        return v && v.length > 0 ? v : null
    } catch {
        return null
    }
}

/** Admin only: persist the active meeting for all users. */
export async function setStoredActiveMeetingId(
    meetingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return { success: false, error: "Forbidden" }
    }
    const id = String(meetingId ?? "").trim()
    if (!id) {
        return { success: false, error: "Missing meeting id" }
    }
    const pk = Number.parseInt(id, 10)
    if (Number.isNaN(pk)) {
        return { success: false, error: "Invalid meeting id" }
    }
    const [row] = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, pk)).limit(1)
    if (!row) {
        return { success: false, error: "Meeting not found" }
    }

    const now = new Date()
    await db
        .insert(appSettings)
        .values({
            key: ACTIVE_MEETING_SETTING_KEY,
            value: String(pk),
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: appSettings.key,
            set: {
                value: String(pk),
                updatedAt: now,
            },
        })

    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { success: true }
}

/** Admin only: remove stored active meeting (e.g. last meeting deleted). */
export async function clearStoredActiveMeetingId(): Promise<{ success: true } | { success: false; error: string }> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return { success: false, error: "Forbidden" }
    }
    await db.delete(appSettings).where(eq(appSettings.key, ACTIVE_MEETING_SETTING_KEY))
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { success: true }
}
