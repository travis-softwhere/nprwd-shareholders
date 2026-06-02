'use server'

import { db } from "@/lib/db"
import { properties, shareholders } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { syncShareholderCheckedInFromProperties } from "@/lib/syncShareholderCheckIn"
import { ensurePropertySignatureColumns } from "@/lib/db/ensure-property-signature-columns"

type CheckInResult = {
    success: boolean
    message?: string
}

export async function checkInShareholders(
    shareholderId: string,
    signatureImage?: string,
    signatureHash?: string,
    meetingId?: string,
    propertyIds?: number[],
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

        await ensurePropertySignatureColumns()

        const checkedInAt = new Date()
        const propertyCheckInUpdate: {
            checkedIn: boolean
            checkedInAt: Date
            signatureImage?: string
            signatureHash?: string
        } = { checkedIn: true, checkedInAt }

        if (signatureImage && signatureHash) {
            propertyCheckInUpdate.signatureImage = signatureImage
            propertyCheckInUpdate.signatureHash = signatureHash
        }

        const propertyConditions = [
            eq(properties.shareholderId, shareholderId),
            eq(properties.checkedIn, false),
        ]
        if (propertyIds?.length) {
            propertyConditions.push(inArray(properties.id, propertyIds))
        }

        const updated = await db
            .update(properties)
            .set(propertyCheckInUpdate)
            .where(and(...propertyConditions))
            .returning({ id: properties.id })

        if (updated.length === 0) {
            return {
                success: false,
                message: propertyIds?.length
                    ? "No matching properties to check in (they may already be checked in)."
                    : "All properties are already checked in.",
            }
        }

        await syncShareholderCheckedInFromProperties(shareholderId)

        const allProperties = await db
            .select({
                checkedIn: properties.checkedIn,
                signatureHash: properties.signatureHash,
            })
            .from(properties)
            .where(eq(properties.shareholderId, shareholderId))

        const allCheckedIn =
            allProperties.length > 0 && allProperties.every((p) => Boolean(p.checkedIn))
        const uniqueHashes = new Set(
            allProperties.map((p) => p.signatureHash?.trim()).filter(Boolean),
        )
        const singleSignatureForAll = allCheckedIn && uniqueHashes.size === 1

        if (singleSignatureForAll && signatureImage && signatureHash) {
            await db
                .update(shareholders)
                .set({
                    checkedInAt,
                    signatureImage,
                    signatureHash,
                })
                .where(eq(shareholders.shareholderId, shareholderId))
        } else {
            await db
                .update(shareholders)
                .set({ checkedInAt: allCheckedIn ? checkedInAt : null })
                .where(eq(shareholders.shareholderId, shareholderId))
        }

        revalidatePath(`/shareholders/${shareholderId}`)
        revalidatePath("/")

        const count = updated.length
        return {
            success: true,
            message:
                count === 1
                    ? "Property checked in successfully"
                    : `${count} properties checked in successfully`,
        }
    }
    catch (error) {
        return {
            success: false,
            message: "Failed to check in shareholders"
        }
    }
}
