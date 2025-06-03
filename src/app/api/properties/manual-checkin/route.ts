import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkInShareholders } from "@/actions/checkInShareholders";
import { undoCheckInShareholders } from "@/actions/undoCheckInShareholders";
import { logToFile, LogLevel } from "@/utils/logger";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get request body
        const body = await request.json();
        const { shareholderId, action } = body;

        if (!shareholderId || !action) {
            return NextResponse.json(
                { error: "Shareholder ID and action are required" },
                { status: 400 }
            );
        }

        // If checking in, verify not already checked in
        if (action === "checkin") {
            const propertiesToCheckIn = await db
                .select()
                .from(properties)
                .where(eq(properties.shareholderId, shareholderId));

            if (!propertiesToCheckIn.length) {
                await logToFile("properties", "No properties found for shareholder checkin", LogLevel.ERROR, {
                    shareholderId
                });
                return NextResponse.json({ error: "No properties found for this shareholder" }, { status: 404 });
            }

            // Check if any properties are already checked in
            const alreadyCheckedIn = propertiesToCheckIn.some(p => p.checkedIn);
            if (alreadyCheckedIn) {
                await logToFile("properties", "Shareholder already checked in", LogLevel.INFO, {
                    shareholderId
                });
                return NextResponse.json({ 
                    error: "This benefit unit owner is already checked in and has a ballot!",
                    alreadyCheckedIn: true 
                }, { status: 400 });
            }
        }

        let result;
        if (action === "checkin") {
            result = await checkInShareholders(shareholderId);
        } else if (action === "undo") {
            result = await undoCheckInShareholders(shareholderId);
        } else {
            return NextResponse.json(
                { error: "Invalid action. Must be 'checkin' or 'undo'" },
                { status: 400 }
            );
        }

        if (!result.success) {
            await logToFile("properties", `Failed to ${action} shareholder`, LogLevel.ERROR, {
                shareholderId,
                error: result.message
            });
            return NextResponse.json({ error: result.message }, { status: 500 });
        }

        await logToFile("properties", `Successfully ${action}ed shareholder`, LogLevel.INFO, {
            shareholderId
        });

        return NextResponse.json({
            message: result.message,
            success: true
        });
    } catch (error) {
        await logToFile("properties", "Error in manual check-in operation", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to process check-in operation" },
            { status: 500 }
        );
    }
} 