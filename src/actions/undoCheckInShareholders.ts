// src/actions/undoCheckInShareholders.ts
"use server";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache"; // <-- add this

export async function undoCheckInShareholders(shareholderId: string) {
  try {
    await db
      .update(properties)
      .set({ checkedIn: false })
      .where(eq(properties.shareholderId, shareholderId));

    revalidatePath(`/shareholders/${shareholderId}`); // <-- add this

    return { success: true, message: "Check-in undone for all properties." };
  } catch (error) {
    return { success: false, message: "Failed to undo check-in." };
  }
}