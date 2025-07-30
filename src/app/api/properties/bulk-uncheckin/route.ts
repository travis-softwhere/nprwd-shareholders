import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
import { logToFile, LogLevel } from "@/utils/logger";

export async function POST(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Update all properties to checked_in = false
        const updatedProperties = await db
            .update(properties)
            .set({ checkedIn: false })
            .returning();

        // Clear signature information and check-in status for all shareholders
        await db
            .update(shareholders)
            .set({ 
                checkedIn: false,
                checkedInAt: null,
                signatureImage: null,
                signatureHash: null
            });

        await logToFile("properties", "Bulk uncheck-in completed", LogLevel.INFO, {
            updatedCount: updatedProperties.length
        });

        return NextResponse.json({
            message: "All properties unchecked-in and signatures cleared successfully",
            updatedCount: updatedProperties.length
        });
    } catch (error) {
        await logToFile("properties", "Error in bulk uncheck-in operation", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to process bulk uncheck-in operation" },
            { status: 500 }
        );
    }
} 