import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { asc, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import {
    BENEFIT_UNIT_OWNER_CORE_TEMPLATE_HEADERS,
    BENEFIT_UNIT_OWNER_CUSTOMER_TEMPLATE_HEADERS,
    BENEFIT_UNIT_OWNER_MAILER_TEMPLATE_HEADER,
    BENEFIT_UNIT_OWNER_RESIDENT_TEMPLATE_HEADERS,
    BENEFIT_UNIT_OWNER_SHARED_ID_TEMPLATE_HEADER,
    escapeCsvField,
    formatBenefitUnitOwnerDedupeKey,
} from "@/lib/benefitUnitOwnerCsvImport"
import type { InferSelectModel } from "drizzle-orm"
import { ensureShareholdersSharedIdColumn } from "@/lib/db/ensure-shareholders-shared-id"

type PropertyRow = InferSelectModel<typeof properties>

function customerAnyNonempty(p: PropertyRow): boolean {
    return Boolean(
        (p.customerName ?? "").trim() ||
            (p.customerMailingAddress ?? "").trim() ||
            (p.cityStateZip ?? "").trim(),
    )
}

function residentAnyNonempty(p: PropertyRow): boolean {
    return Boolean(
        (p.residentName ?? "").trim() ||
            (p.residentMailingAddress ?? "").trim() ||
            (p.residentCityStateZip ?? "").trim(),
    )
}

/**
 * Admin: download benefit unit owner rows for a meeting as CSV (import-compatible headers).
 * Omits customer/resident column groups when every row would be empty.
 * After `mailer_id`, optional column `shared_id` is included when any shareholder in the export has it set
 * (CSV import grouping key; canonical mailing on shareholder is first row in file order).
 * `mailer_id` holds the dedupe key prefix from stored shareholder mailing fields:
 * `mail|zip|` (third segment empty — CSV mailer_id is not stored in DB per schema).
 */
export async function GET(
    _request: Request,
    context: { params: Promise<{ meetingId: string }> },
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        await ensureShareholdersSharedIdColumn()

        const { meetingId } = await context.params
        const mid = meetingId?.trim() ?? ""
        if (!mid) {
            return NextResponse.json({ error: "meetingId is required" }, { status: 400 })
        }

        const variants = await shareholderMeetingIdVariantsForFilter(mid)
        const shRows = await db.select().from(shareholders).where(inArray(shareholders.meetingId, variants))

        const shareholderIds = shRows.map((s) => s.shareholderId)
        const propRows: PropertyRow[] =
            shareholderIds.length > 0
                ? await db
                      .select()
                      .from(properties)
                      .where(inArray(properties.shareholderId, shareholderIds))
                      .orderBy(asc(properties.account))
                : []

        const shareholderById = new Map(shRows.map((s) => [s.shareholderId, s]))

        const includeCustomer = propRows.some(customerAnyNonempty)
        const includeResident = propRows.some(residentAnyNonempty)
        const includeSharedId = shRows.some((s) => (s.sharedId ?? "").trim().length > 0)

        const headers = [
            ...BENEFIT_UNIT_OWNER_CORE_TEMPLATE_HEADERS,
            ...(includeCustomer ? BENEFIT_UNIT_OWNER_CUSTOMER_TEMPLATE_HEADERS : []),
            ...(includeResident ? BENEFIT_UNIT_OWNER_RESIDENT_TEMPLATE_HEADERS : []),
            BENEFIT_UNIT_OWNER_MAILER_TEMPLATE_HEADER,
            ...(includeSharedId ? [BENEFIT_UNIT_OWNER_SHARED_ID_TEMPLATE_HEADER] : []),
        ]

        const headerLine = headers.map(escapeCsvField).join(",")

        const dataLines = propRows.map((p) => {
            const sh = shareholderById.get(p.shareholderId)
            const dedupeKey = sh
                ? formatBenefitUnitOwnerDedupeKey({
                      ownerMailingAddress: sh.ownerMailingAddress,
                      ownerCityStateZip: sh.ownerCityStateZip,
                      mailerId: "",
                  })
                : formatBenefitUnitOwnerDedupeKey({
                      ownerMailingAddress: p.ownerMailingAddress,
                      ownerCityStateZip: p.ownerCityStateZip,
                      mailerId: "",
                  })
            const core = [
                p.account,
                p.numOf ?? "",
                p.ownerName ?? "",
                p.ownerMailingAddress ?? "",
                p.ownerCityStateZip ?? "",
                p.serviceAddress ?? "",
            ]
            const customer = includeCustomer
                ? [p.customerName ?? "", p.customerMailingAddress ?? "", p.cityStateZip ?? ""]
                : []
            const resident = includeResident
                ? [p.residentName ?? "", p.residentMailingAddress ?? "", p.residentCityStateZip ?? ""]
                : []
            const sharedCell = includeSharedId ? [(sh?.sharedId ?? "").trim()] : []
            return [...core, ...customer, ...resident, dedupeKey, ...sharedCell].map(escapeCsvField).join(",")
        })

        const body = "\uFEFF" + [headerLine, ...dataLines].join("\r\n") + "\r\n"
        const safeFile = `benefit-unit-owners-meeting-${mid}.csv`

        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${safeFile}"`,
            },
        })
    } catch (error) {
        console.error("export-csv:", error)
        return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 })
    }
}
