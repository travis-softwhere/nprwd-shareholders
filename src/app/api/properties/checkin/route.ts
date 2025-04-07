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
        const { propertyId, checkedIn } = body;

        if (!propertyId) {
            return NextResponse.json(
                { error: "Property ID is required" },
                { status: 400 }
            );
        }

        // Ensure property exists before updating
        const [existingProperty] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)));
        
        if (!existingProperty) {
            await logToFile("properties", "Property not found for checkin", LogLevel.ERROR, {
                propertyId
            });
            return NextResponse.json({ error: "Property not found" }, { status: 404 });
        }

        // Update the checkedIn status
        const [updatedProperty] = await db
            .update(properties)
            .set({
                checkedIn: checkedIn === true,
            })
            .where(eq(properties.id, parseInt(propertyId)))
            .returning();

        await logToFile("properties", "Property check-in status updated", LogLevel.INFO, {
            propertyId,
            previousCheckedIn: existingProperty.checkedIn,
            newCheckedIn: updatedProperty.checkedIn
        });

        return NextResponse.json(updatedProperty);
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
