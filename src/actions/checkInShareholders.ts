'use server'

import { db } from "@/lib/db"
import { properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type CheckInResult = {
    success: boolean
    message?: string
}

export async function checkInShareholders(shareholderId: string): Promise<CheckInResult> {
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

        // Check in all properties for this shareholder 
        await db.update(properties)
        .set({ checkedIn: true })
        .where(eq(properties.shareholderId, shareholderId))

        revalidatePath(`/shareholders/${shareholderId}`)

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
