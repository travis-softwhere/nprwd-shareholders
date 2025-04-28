// Check-in for all properties owned by a shareholder.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, properties, shareholders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
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

        // Update all properties to checked_in = true
        const updatedProperties = await db
            .update(properties)
            .set({ checkedIn: true })
            .where(eq(properties.shareholderId, shareholderId))
            .returning();

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
