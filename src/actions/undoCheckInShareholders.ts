"use server";

import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope";
import { revalidatePath } from "next/cache";
import { ensurePropertySignatureColumns } from "@/lib/db/ensure-property-signature-columns";
import { syncShareholderCheckedInFromProperties } from "@/lib/syncShareholderCheckIn";

export async function undoCheckInShareholders(
  shareholderId: string,
  meetingId?: string,
  propertyIds?: number[],
) {
  try {
    const [row] = await db
      .select()
      .from(shareholders)
      .where(eq(shareholders.shareholderId, shareholderId))
      .limit(1);

    if (!row) {
      return { success: false, message: "Shareholder not found." };
    }

    if (meetingId != null) {
      const variants = await shareholderMeetingIdVariantsForFilter(meetingId);
      const rowMid = String(row.meetingId).trim();
      if (!variants.includes(rowMid)) {
        return {
          success: false,
          message: "This benefit unit owner is not part of the selected meeting.",
        };
      }
    }

    await ensurePropertySignatureColumns();

    const ids =
      propertyIds?.map((id) => Number(id)).filter((id) => Number.isFinite(id)) ?? [];

    const propertyCondition =
      ids.length > 0
        ? and(eq(properties.shareholderId, shareholderId), inArray(properties.id, ids))
        : eq(properties.shareholderId, shareholderId);

    const targets = await db
      .select({ id: properties.id, checkedIn: properties.checkedIn })
      .from(properties)
      .where(propertyCondition);

    if (!targets.length) {
      return { success: false, message: "No matching properties found." };
    }

    const checkedTargets = targets.filter((p) => Boolean(p.checkedIn));
    if (!checkedTargets.length) {
      return { success: false, message: "Selected properties are not checked in." };
    }

    await db
      .update(properties)
      .set({
        checkedIn: false,
        signatureImage: null,
        signatureHash: null,
        checkedInAt: null,
      })
      .where(
        ids.length > 0
          ? inArray(
              properties.id,
              checkedTargets.map((p) => p.id),
            )
          : eq(properties.shareholderId, shareholderId),
      );

    const { checkedInCount, allChecked } =
      await syncShareholderCheckedInFromProperties(shareholderId);

    await db
      .update(shareholders)
      .set({
        checkedIn: allChecked,
        checkedInAt: checkedInCount > 0 ? row.checkedInAt : null,
        signatureImage: null,
        signatureHash: null,
      })
      .where(eq(shareholders.shareholderId, shareholderId));

    revalidatePath(`/shareholders/${shareholderId}`);
    revalidatePath("/");

    const count = checkedTargets.length;
    const message =
      count === 1
        ? "Property check-in undone."
        : ids.length > 0
          ? `${count} properties check-in undone.`
          : "Check-in undone for all properties.";

    return { success: true, message };
  } catch {
    return { success: false, message: "Failed to undo check-in." };
  }
}
