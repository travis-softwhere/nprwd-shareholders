import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { shareholderMeetingIdVariantsForFilter } from "@/lib/shareholderMeetingScope"
import {
    formatBenefitUnitOwnerGroupKey,
    normalizeBenefitUnitOwnerColumnName,
} from "@/lib/benefitUnitOwnerCsvImport"
//import { v4 as uuidv4 } from "uuid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureShareholdersSharedIdColumn } from "@/lib/db/ensure-shareholders-shared-id"

export async function POST(request: Request) {
    const startTime = Date.now()

    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            throw new Error("Unauthorized")
        }

        await ensureShareholdersSharedIdColumn()

        // Get form data with error boundary
        let formData: FormData
        try {
            formData = await request.formData()
        } catch (error) {
            throw new Error(`Failed to parse form data: ${error}`)
        }

        const file = formData.get("file") as File
        const meetingIdRaw = (formData.get("meetingId") as string | null)?.trim() ?? ""

        if (!file || !meetingIdRaw) {
            throw new Error("Missing required fields")
        }

        const meetingPk = Number.parseInt(meetingIdRaw, 10)
        if (Number.isNaN(meetingPk)) {
            throw new Error("Invalid meeting id — use the numeric meeting id from the Meetings list")
        }

        const [meetingRow] = await db
            .select({ id: meetings.id })
            .from(meetings)
            .where(eq(meetings.id, meetingPk))
            .limit(1)

        if (!meetingRow) {
            throw new Error(`No meeting found for id ${meetingPk}. Choose the active meeting on the Meetings tab and try again.`)
        }

        /** Canonical PK string — always stored on imported shareholders so meeting filters match reliably. */
        const meetingId = String(meetingRow.id)

        // Read file content with error boundary
        let content: string
        try {
            content = await file.text()
        } catch (error) {
            throw new Error(`Failed to read file: ${error}`)
        }

        // Parse CSV with error boundary
        let records: any[]
        try {
            records = parse(content, {
                columns: (headers: string[]) =>
                    headers.map((h) => normalizeBenefitUnitOwnerColumnName(h)),
                skip_empty_lines: true,
                trim: true,
            })

            records = records.filter(
                (record) =>
                Object.values(record).some(
                    (value) => typeof value === "string" && value.trim() !== ""
                )
            )

        } catch (error) {
            throw new Error(`Failed to parse CSV: ${error}`)
        }

        // Clear existing data (canonical id and legacy year-stored meeting_id)
        try {
            const meetingVariants = await shareholderMeetingIdVariantsForFilter(meetingId)
            const existingShareholders = await db
                .select({ shareholderId: shareholders.shareholderId })
                .from(shareholders)
                .where(inArray(shareholders.meetingId, meetingVariants))

            if (existingShareholders.length > 0) {
                const shareholderIds = existingShareholders.map((s) => s.shareholderId)
                await db.delete(properties).where(inArray(properties.shareholderId, shareholderIds))
                await db.delete(shareholders).where(inArray(shareholders.meetingId, meetingVariants))
            }
        } catch (error) {
            throw new Error(`Failed to clear existing data: ${error}`)
        }

        // Process records
        const uniqueShareholders = new Map()
        const shareholderValues = []
        const propertyValues = []

        /** Prefix IDs with meeting PK so shareholder_id stays globally unique across meetings (plain numeric IDs collide with other imports). */
        const shareholderIdPrefix = `${meetingId}-`
        let nextId = 100000

        for (let i = 0; i < records.length; i++) {
            const record = records[i]
            const ownerKey = formatBenefitUnitOwnerGroupKey(record, i)

            let shareholderId = uniqueShareholders.get(ownerKey);

            if (!shareholderId) {
                shareholderId = `${shareholderIdPrefix}${nextId++}`
                uniqueShareholders.set(ownerKey, shareholderId);
                const sharedRaw = String(record["shared_id"] ?? "").trim()
                shareholderValues.push({
                    name: (record["owner_name"] || "Unknown").trim(),
                    meetingId,
                    shareholderId,
                    ownerMailingAddress: (record["owner_mailing_address"] || "").trim(),
                    ownerCityStateZip: (record["owner_city_state_zip"] || "").trim(),
                    ...(sharedRaw.length > 0 ? { sharedId: sharedRaw } : {}),
                });
            }

            propertyValues.push({
                account: record["account"] || "",
                shareholderId,
                numOf: String(record["num_of"] ?? "").trim(),
                customerName: record.customer_name || "",
                customerMailingAddress: record.customer_mailing_address || "",
                cityStateZip: record.city_state_zip || "",
                ownerName: (record["owner_name"] || "").trim(),
                ownerMailingAddress: (record["owner_mailing_address"] || "").trim(),
                ownerCityStateZip: (record["owner_city_state_zip"] || "").trim(),
                residentName: record.resident_name || "",
                residentMailingAddress: record.resident_mailing_address || "",
                residentCityStateZip: record.resident_city_state_zip || "",
                serviceAddress: record["service_address"] || "",
            });
        }

        // Now insert everything at once, with batching and progress logs
        const BATCH_SIZE = 100;

        // Shareholder batch insert with progress logs
        if (shareholderValues.length > 0) {
            try {
                for (let i = 0; i < shareholderValues.length; i += BATCH_SIZE) {
                    const batch = shareholderValues.slice(i, i + BATCH_SIZE);
                    console.log(`Inserting shareholder batch ${i + 1} to ${i + batch.length} of ${shareholderValues.length}`);
                    await db.insert(shareholders).values(batch);
                }
            } catch (error) {
                // Try to find the problematic record
                for (let i = 0; i < shareholderValues.length; i++) {
                    try {
                        await db.insert(shareholders).values([shareholderValues[i]]);
                    } catch (indivError) {
                        console.error(`Shareholder insert failed at index ${i}:`, shareholderValues[i]);
                        throw new Error(
                          `Shareholder insert failed at index ${i}: ${JSON.stringify(shareholderValues[i])} - ${indivError instanceof Error ? indivError.message : indivError}`
                        );
                    }
                }
                throw error;
            }
        }

        // Property batch insert with progress logs
        if (propertyValues.length > 0) {
            try {
                for (let i = 0; i < propertyValues.length; i += BATCH_SIZE) {
                    const batch = propertyValues.slice(i, i + BATCH_SIZE);
                    console.log(`Inserting property batch ${i + 1} to ${i + batch.length} of ${propertyValues.length}`);
                    await db.insert(properties).values(batch);
                }
            } catch (error) {
                // Try to find the problematic record
                for (let i = 0; i < propertyValues.length; i++) {
                    try {
                        await db.insert(properties).values([propertyValues[i]]);
                    } catch (indivError) {
                        console.error(`Property insert failed at index ${i}:`, propertyValues[i]);
                        throw new Error(
                          `Property insert failed at index ${i}: ${JSON.stringify(propertyValues[i])} - ${indivError instanceof Error ? indivError.message : indivError}`
                        );
                    }
                }
                throw error;
            }
        }

        // Update meeting statistics
        try {
            await db
                .update(meetings)
                .set({ totalShareholders: uniqueShareholders.size })
                .where(eq(meetings.id, meetingRow.id))
        } catch (error) {
            throw new Error(`Failed to update meeting statistics: ${error}`)
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${records.length} records in ${totalTime} seconds`,
            totalRecords: records.length,
            totalShareholders: uniqueShareholders.size,
            totalProperties: propertyValues.length,
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        )
    }
}