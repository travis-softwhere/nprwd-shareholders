// Check-in for all properties owned by a shareholder.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logToFile, LogLevel } from "@/utils/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
        const { shareholderId } = body;

        if (!shareholderId) {
            return NextResponse.json(
                { error: "Shareholder ID is required" },
                { status: 400 }
            );
        }

        // Find all properties for this shareholder
        const propertiesToCheckIn = await query<{
            id: number;
            checked_in: boolean;
        }>(
            'SELECT id, checked_in FROM properties WHERE shareholder_id = $1',
            [shareholderId]
        );

        if (!propertiesToCheckIn.length) {
            await logToFile("properties", "No properties found for shareholder checkin", LogLevel.ERROR, {
                shareholderId
            });
            return NextResponse.json({ error: "No properties found for this shareholder" }, { status: 404 });
        }

        // Check if any properties are already checked in
        const alreadyCheckedIn = propertiesToCheckIn.some(p => p.checked_in);
        if (alreadyCheckedIn) {
            await logToFile("properties", "Shareholder already checked in", LogLevel.INFO, {
                shareholderId
            });
            return NextResponse.json({ 
                error: "This benefit unit owner is already checked in and has a ballot!",
                alreadyCheckedIn: true 
            }, { status: 400 });
        }

        // Update all properties to checked_in = true
        const updatedProperties = await query<{
            id: number;
            checked_in: boolean;
        }>(
            'UPDATE properties SET checked_in = true WHERE shareholder_id = $1 RETURNING id, checked_in',
            [shareholderId]
        );

        await logToFile("properties", "Properties checked in for shareholder", LogLevel.INFO, {
            shareholderId,
            updatedCount: updatedProperties.length
        });

        return NextResponse.json({
            message: "Properties checked in successfully",
            updatedCount: updatedProperties.length,
            updatedProperties
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
