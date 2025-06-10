// src/actions/undoCheckInShareholders.ts
"use server";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function undoCheckInShareholders(shareholderId: string) {
  try {
    await query(
      'UPDATE properties SET checked_in = false WHERE shareholder_id = $1',
      [shareholderId]
    );

    revalidatePath(`/shareholders/${shareholderId}`);

    return { success: true, message: "Check-in undone for all properties." };
  } catch (error) {
    return { success: false, message: "Failed to undo check-in." };
  }
}