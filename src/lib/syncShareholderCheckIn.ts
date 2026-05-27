import { db } from "@/lib/db"
import { properties, shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/** Set shareholders.checked_in to true only when every property for that owner is checked in. */
export async function syncShareholderCheckedInFromProperties(shareholderId: string) {
  const rows = await db
    .select({ checkedIn: properties.checkedIn })
    .from(properties)
    .where(eq(properties.shareholderId, shareholderId))

  const propertyCount = rows.length
  const checkedInCount = rows.filter((p) => Boolean(p.checkedIn)).length
  const allChecked = propertyCount > 0 && checkedInCount === propertyCount

  await db
    .update(shareholders)
    .set({ checkedIn: allChecked })
    .where(eq(shareholders.shareholderId, shareholderId))

  return { allChecked, propertyCount, checkedInCount }
}
