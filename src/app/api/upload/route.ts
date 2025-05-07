import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { db } from "@/lib/db"
import { shareholders, properties, meetings } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
//import { v4 as uuidv4 } from "uuid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    const startTime = Date.now()

    // Generate a random 6-digit numeric ID instead of UUID
    const generateRandomId = () => {
        return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
    };


    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            throw new Error("Unauthorized")
        }

        // Get form data with error boundary
        let formData: FormData
        try {
            formData = await request.formData()
        } catch (error) {
            throw new Error(`Failed to parse form data: ${error}`)
        }

        const file = formData.get("file") as File
        const meetingId = formData.get("meetingId") as string

        if (!file || !meetingId) {
            throw new Error("Missing required fields")
        }

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
                columns: true,
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

        // Clear existing data
        try {
            const existingShareholders = await db
                .select({ shareholderId: shareholders.shareholderId })
                .from(shareholders)
                .where(eq(shareholders.meetingId, meetingId))

            if (existingShareholders.length > 0) {
                const shareholderIds = existingShareholders.map((s) => s.shareholderId)
                await db.delete(properties).where(inArray(properties.shareholderId, shareholderIds))
                await db.delete(shareholders).where(eq(shareholders.meetingId, meetingId))
            }
        } catch (error) {
            throw new Error(`Failed to clear existing data: ${error}`)
        }

        // Process records
        const uniqueShareholders = new Map()
        const shareholderValues = []
        const propertyValues = []

        for (const record of records) {
            // Normalize and combine both fields for the key
            const ownerMailingAddress = (record["owner_mailing_address"] || "").trim().toUpperCase();
            const ownerCityStateZip = (record["owner_city_state_zip"] || "").trim().toUpperCase();
            const ownerKey = `${ownerMailingAddress}|${ownerCityStateZip}`;

            let shareholderId = uniqueShareholders.get(ownerKey);

            if (!shareholderId) {
                shareholderId = generateRandomId();
                uniqueShareholders.set(ownerKey, shareholderId);
                shareholderValues.push({
                    name: (record["owner_name"] || "Unknown").trim(),
                    meetingId,
                    shareholderId,
                    ownerMailingAddress: (record["owner_mailing_address"] || "").trim(),
                    ownerCityStateZip: (record["owner_city_state_zip"] || "").trim(),
                });
            }

            propertyValues.push({
                account: record["account"] || "",
                shareholderId,
                numOf: record.num_of || "",
                customerName: record.customer_name || "",
                customerMailingAddress: record.customer_mailing_address || "",
                cityStateZip: record.city_state_zip || "",
                ownerName: record.owner_name || "",
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
                    await db.insert(shareholders).values(batch).onConflictDoNothing();
                }
            } catch (error) {
                // Try to find the problematic record
                for (let i = 0; i < shareholderValues.length; i++) {
                    try {
                        await db.insert(shareholders).values([shareholderValues[i]]).onConflictDoNothing();
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
                .where(eq(meetings.id, Number.parseInt(meetingId)))
        } catch (error) {
            throw new Error(`Failed to update meeting statistics: ${error}`)
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${records.length} records in ${totalTime} seconds`,
            totalRecords: records.length,
            totalShareholders: uniqueShareholders.size,
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