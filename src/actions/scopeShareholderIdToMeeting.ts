"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { properties, propertyTransfers, shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
    canonicalShareholderId,
    needsShareholderIdMeetingScope,
} from "@/lib/meetingScopedShareholderId"

export type ScopeShareholderIdResult =
    | { success: true; shareholderId: string; previousShareholderId: string; unchanged?: boolean }
    | { success: false; message: string }

/**
 * Rewrites `shareholders.shareholder_id` and related FKs to `{meetingId}-{suffix}` for mailers / barcode check-in.
 */
export async function scopeShareholderIdToMeeting(
    storedShareholderId: string,
): Promise<ScopeShareholderIdResult> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return { success: false, message: "Admin access required" }
    }

    const currentId = storedShareholderId.trim()
    if (!currentId) {
        return { success: false, message: "Shareholder ID is required" }
    }

    const [row] = await db
        .select()
        .from(shareholders)
        .where(eq(shareholders.shareholderId, currentId))
        .limit(1)

    if (!row) {
        return { success: false, message: "Benefit unit owner not found" }
    }

    const meetingId = String(row.meetingId).trim()
    const newId = canonicalShareholderId(row.shareholderId, meetingId)

    if (!needsShareholderIdMeetingScope(row.shareholderId, meetingId)) {
        return {
            success: true,
            shareholderId: newId,
            previousShareholderId: currentId,
            unchanged: true,
        }
    }

    const [conflict] = await db
        .select({ shareholderId: shareholders.shareholderId })
        .from(shareholders)
        .where(eq(shareholders.shareholderId, newId))
        .limit(1)

    if (conflict) {
        return {
            success: false,
            message: `Cannot update: ${newId} is already assigned to another benefit unit owner.`,
        }
    }

    await db.transaction(async (tx) => {
        await tx
            .update(properties)
            .set({ shareholderId: newId })
            .where(eq(properties.shareholderId, currentId))
        await tx
            .update(propertyTransfers)
            .set({ fromShareholderId: newId })
            .where(eq(propertyTransfers.fromShareholderId, currentId))
        await tx
            .update(propertyTransfers)
            .set({ toShareholderId: newId })
            .where(eq(propertyTransfers.toShareholderId, currentId))
        await tx
            .update(shareholders)
            .set({ shareholderId: newId })
            .where(eq(shareholders.shareholderId, currentId))
    })

    revalidatePath("/shareholders")
    revalidatePath(`/shareholders/${currentId}`)
    revalidatePath(`/shareholders/${newId}`)
    revalidatePath("/properties")
    revalidatePath("/")

    return {
        success: true,
        shareholderId: newId,
        previousShareholderId: currentId,
    }
}
