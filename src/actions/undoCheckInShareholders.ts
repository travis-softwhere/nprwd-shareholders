// src/actions/undoCheckInShareholders.ts
"use server";
import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function undoCheckInShareholders(shareholderId: string) {
  try {
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