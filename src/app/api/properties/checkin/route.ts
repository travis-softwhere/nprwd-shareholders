// Check-in for all properties owned by a shareholder.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, properties, shareholders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logToFile, LogLevel } from "@/utils/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkInShareholders } from "@/actions/checkInShareholders";

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
        const { shareholderId, signatureImage, signatureHash } = body;

        if (!shareholderId) {
            return NextResponse.json(
                { error: "Shareholder ID is required" },
                { status: 400 }
            );
        }

        // Require signature for check-in
        if (!signatureImage || !signatureHash) {
            return NextResponse.json(
                { error: "Signature is required for check-in" },
                { status: 400 }
            );
        }

        // Find all properties for this shareholder
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

        // Use the checkInShareholders action to handle the check-in
        const result = await checkInShareholders(shareholderId, signatureImage, signatureHash);

        if (!result.success) {
            await logToFile("properties", "Failed to check in shareholder", LogLevel.ERROR, {
                shareholderId,
                error: result.message
            });
            return NextResponse.json({ error: result.message }, { status: 500 });
        }

        await logToFile("properties", "Properties checked in for shareholder", LogLevel.INFO, {
            shareholderId
        });

        return NextResponse.json({
            message: "Properties checked in successfully"
        });
    } catch (error) {
        await logToFile("properties", "Error updating property check-in status", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to update property check-in status" },
            { status: 500 }
        );
    }
}
