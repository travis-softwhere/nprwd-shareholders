"use server"

import { db } from "@/lib/db"
import { shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { syncShareholderCheckedInFromProperties } from "@/lib/syncShareholderCheckIn"

export async function saveShareholderSignature(
  shareholderId: string,
  signatureImage: string,
  signatureHash: string,
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { success: false, message: "Unauthorized" }
  }

  if (!shareholderId || !signatureImage?.trim() || !signatureHash?.trim()) {
    return { success: false, message: "Shareholder ID and signature are required" }
  }

  const [row] = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.shareholderId, shareholderId))
    .limit(1)

  if (!row) {
    return { success: false, message: "Shareholder not found" }
  }

  await db
    .update(shareholders)
    .set({
      signatureImage,
      signatureHash,
      checkedInAt: new Date(),
    })
    .where(eq(shareholders.shareholderId, shareholderId))

  await syncShareholderCheckedInFromProperties(shareholderId)

  revalidatePath(`/shareholders/${shareholderId}`)

  return { success: true }
}
