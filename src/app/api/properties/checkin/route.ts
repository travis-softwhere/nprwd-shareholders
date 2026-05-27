// Check-in for all properties owned by a shareholder.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
import { benefitUnitOwnerHasCompletedCheckIn } from "@/lib/benefitUnitOwnerCheckIn";
import { eq } from "drizzle-orm";
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
        const { shareholderId, signatureImage, signatureHash, meetingId } = body;

        if (!shareholderId) {
            return NextResponse.json(
                { error: "Shareholder ID is required" },
                { status: 400 }
            );
        }

        if (!meetingId || typeof meetingId !== "string") {
            return NextResponse.json(
                { error: "Meeting ID is required" },
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

        const [shareholderRow] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, shareholderId))
            .limit(1);

        if (
            benefitUnitOwnerHasCompletedCheckIn(
                shareholderRow ?? {},
                propertiesToCheckIn,
            )
        ) {
            await logToFile("properties", "Shareholder already checked in with signature", LogLevel.INFO, {
                shareholderId,
            });
            return NextResponse.json({
                message: "Already checked in",
                success: true,
                alreadyCheckedIn: true,
            });
        }

        // Use the checkInShareholders action to handle the check-in (all properties + signature)
        const result = await checkInShareholders(shareholderId, signatureImage, signatureHash, meetingId);

        if (!result.success) {
            await logToFile("properties", "Failed to check in shareholder", LogLevel.ERROR, {
                shareholderId,
                error: result.message
            });
            const status = result.message?.includes("not part of the selected meeting") ? 400 : 500;
            return NextResponse.json({ error: result.message }, { status });
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
