// src/actions/undoCheckInShareholders.ts
"use server";
import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { revalidatePath } from "next/cache";

export async function undoCheckInShareholders(shareholderId: string, meetingId?: string) {
  try {
    const [row] = await db
      .select()
      .from(shareholders)
      .where(eq(shareholders.shareholderId, shareholderId))
      .limit(1)

    if (!row) {
      return { success: false, message: "Shareholder not found." }
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

    // Update properties to set checkedIn to false
    await db
      .update(properties)
      .set({ checkedIn: false })
      .where(eq(properties.shareholderId, shareholderId));

    // Update shareholder record to clear signature information and check-in status
    await db
      .update(shareholders)
      .set({ 
        checkedIn: false,
        checkedInAt: null,
        signatureImage: null,
        signatureHash: null
      })
      .where(eq(shareholders.shareholderId, shareholderId));

    revalidatePath(`/shareholders/${shareholderId}`);

    return { success: true, message: "Check-in undone and signature cleared for all properties." };
  } catch (error) {
    return { success: false, message: "Failed to undo check-in." };
  }
}