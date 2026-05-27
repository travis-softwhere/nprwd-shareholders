'use server'

import { db } from "@/lib/db"
import { properties, shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { syncShareholderCheckedInFromProperties } from "@/lib/syncShareholderCheckIn"

type CheckInResult = {
    success: boolean
    message?: string
}

export async function checkInShareholders(
    shareholderId: string,
    signatureImage?: string,
    signatureHash?: string,
    meetingId?: string
): Promise<CheckInResult> {
    try {
        // Verify user is authenticated
        const session = await getServerSession(authOptions)
        if (!session) {
            return {
                success: false,
                message: "Unauthorized"
            }
        }

        if (!shareholderId) {
            return {
                success: false,
                message: "Shareholder ID is required"
            }
        }

        const [row] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, shareholderId))
            .limit(1)

        if (!row) {
            return { success: false, message: "Shareholder not found" }
        }

        if (meetingId != null) {
            const variants = await shareholderMeetingIdVariantsForFilter(meetingId)
            const rowMid = String(row.meetingId).trim()
            if (!variants.includes(rowMid)) {
                return {
                    success: false,
                    message: "This benefit unit owner is not part of the selected meeting.",
                }
            }
        }

        await db.update(properties)
            .set({ checkedIn: true })
            .where(eq(properties.shareholderId, shareholderId))

        await db.update(shareholders)
            .set({
                checkedInAt: new Date(),
                ...(signatureImage && signatureHash
                    ? { signatureImage, signatureHash }
                    : {}),
            })
            .where(eq(shareholders.shareholderId, shareholderId))

        await syncShareholderCheckedInFromProperties(shareholderId)

        revalidatePath(`/shareholders/${shareholderId}`)
        revalidatePath("/")

        return {
            success: true,
            message: "Shareholders checked in successfully"
        }
    }
    catch (error) {
        return {
            success: false,
            message: "Failed to check in shareholders"
        }
    }
}
