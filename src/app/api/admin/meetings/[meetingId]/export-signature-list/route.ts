import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { meetings, properties, shareholders } from "@/lib/db/schema"
import { asc, eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import { ensurePropertySignatureColumns } from "@/lib/db/ensure-property-signature-columns"
import {
  buildMeetingSignatureListPdfBytes,
  meetingSignatureListPdfFileName,
} from "@/lib/generateBenefitUnitOwnerSignaturePdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Admin: one compact PDF listing all checked-in owners, properties, and signatures. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await ensurePropertySignatureColumns()

    const { meetingId } = await context.params
    const mid = meetingId?.trim() ?? ""
    if (!mid) {
      return NextResponse.json({ error: "meetingId is required" }, { status: 400 })
    }

    const meetingIdNum = Number.parseInt(mid, 10)
    const [meetingRow] = Number.isFinite(meetingIdNum)
      ? await db.select().from(meetings).where(eq(meetings.id, meetingIdNum)).limit(1)
      : []

    const variants = await shareholderMeetingIdVariantsForFilter(mid)
    const shRows = await db
      .select()
      .from(shareholders)
      .where(inArray(shareholders.meetingId, variants))
      .orderBy(asc(shareholders.name))

    const shareholderIds = shRows.map((s) => s.shareholderId)
    const propRows =
      shareholderIds.length > 0
        ? await db
            .select()
            .from(properties)
            .where(inArray(properties.shareholderId, shareholderIds))
            .orderBy(asc(properties.account))
        : []

    const propsByShareholder = new Map<string, typeof propRows>()
    for (const property of propRows) {
      const list = propsByShareholder.get(property.shareholderId) ?? []
      list.push(property)
      propsByShareholder.set(property.shareholderId, list)
    }

    const owners = shRows.map((sh) => ({
      shareholderId: sh.shareholderId,
      name: sh.name,
      ownerMailingAddress: sh.ownerMailingAddress,
      ownerCityStateZip: sh.ownerCityStateZip,
      designee: sh.designee,
      properties: propsByShareholder.get(sh.shareholderId) ?? [],
    }))

    const hasAnyCheckIn = owners.some((o) => o.properties.some((p) => Boolean(p.checkedIn)))
    if (!hasAnyCheckIn) {
      return NextResponse.json(
        { error: "No checked-in benefit unit owners for this meeting." },
        { status: 404 },
      )
    }

    const pdfBytes = buildMeetingSignatureListPdfBytes({
      meetingId: mid,
      meetingYear: meetingRow?.year ?? mid,
      meetingDate: meetingRow?.date ?? null,
      owners,
    })

    const filename = meetingSignatureListPdfFileName(mid, meetingRow?.year ?? mid)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("export-signature-list:", error)
    return NextResponse.json({ error: "Failed to export signature list" }, { status: 500 })
  }
}
