import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkInShareholders } from "@/actions/checkInShareholders";
import { undoCheckInShareholders } from "@/actions/undoCheckInShareholders";
import { benefitUnitOwnerHasCompletedCheckIn } from "@/lib/benefitUnitOwnerCheckIn";
import { logToFile, LogLevel } from "@/utils/logger";
import { db } from "@/lib/db";
import { properties, shareholders } from "@/lib/db/schema";
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
        const { shareholderId, action, signatureImage, signatureHash, meetingId } = body;

        if (!shareholderId || !action) {
            return NextResponse.json(
                { error: "Shareholder ID and action are required" },
                { status: 400 }
            );
        }

        if (!meetingId || typeof meetingId !== "string") {
            return NextResponse.json(
                { error: "Meeting ID is required" },
                { status: 400 }
            );
        }

        if (action === "checkin") {
            if (!signatureImage || !signatureHash) {
                return NextResponse.json(
                    { error: "Signature is required for check-in" },
                    { status: 400 }
                );
            }

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
                return NextResponse.json({
                    message: "Already checked in",
                    success: true,
                    alreadyCheckedIn: true,
                });
            }
        }

        let result;
        if (action === "checkin") {
            result = await checkInShareholders(shareholderId, signatureImage, signatureHash, meetingId);
        } else if (action === "undo") {
            result = await undoCheckInShareholders(shareholderId, meetingId);
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
            const status = result.message?.includes("not part of the selected meeting") ? 400 : 500;
            return NextResponse.json({ error: result.message }, { status });
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