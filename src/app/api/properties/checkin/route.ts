// Check-in for all properties owned by a shareholder.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, properties, shareholders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logToFile, LogLevel } from "@/utils/logger";

export async function POST(request: Request) {
    try {
        await logToFile("checkin", "Check-in request received", LogLevel.INFO);
        
        // Parse the request body expecting a shareholderId string.
        const { shareholderId } = await request.json();
        await logToFile("checkin", "Request validation", LogLevel.INFO, {
            hasShareholderId: !!shareholderId
        });
        
        if(!shareholderId){
            await logToFile("checkin", "Missing shareholderId", LogLevel.ERROR);
            return NextResponse.json({ error: "shareholderId is required" }, { status: 400 });
        }

        // First get the shareholder record to get the meetingId
        const [foundShareholder] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, shareholderId));

        // Log shareholder found status without exposing details
        await logToFile("checkin", "Shareholder lookup result", LogLevel.INFO, {
            shareholderFound: !!foundShareholder
        });

        if (!foundShareholder) {
            await logToFile("checkin", "Shareholder not found", LogLevel.ERROR);
            return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
        }

        // Now get the meeting record using the meetingId from the shareholder
        const [foundMeeting] = await db
            .select()
            .from(meetings)
            .where(eq(meetings.id, Number(foundShareholder.meetingId)));

        // Log meeting found status without exposing details
        await logToFile("checkin", "Meeting lookup result", LogLevel.INFO, {
            meetingFound: !!foundMeeting,
            meetingId: foundMeeting?.id
        });

        if (!foundMeeting) {
            await logToFile("checkin", "Meeting not found", LogLevel.ERROR);
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        // TODO: If we later decide to store an individual check-in flag on the shareholder record,
        // we can update this variable to check that flag instead of defaulting to false.
        // For now, we'll allow multiple check-ins as we're only tracking the total count.
        let wasAlreadyCheckedIn = false;

        // Get safe values (if any field might be null)
        const totalShareholders = foundMeeting.totalShareholders || 0;
        const checkedIn = foundMeeting.checkedIn || 0;
        
        await logToFile("checkin", "Retrieved meeting attendance info", LogLevel.INFO, {
            totalShareholders,
            currentCheckedIn: checkedIn
        });

        // Update the meeting check-in count if not already checked in
        if (!wasAlreadyCheckedIn) {
            await logToFile("checkin", "Updating meeting check-in count", LogLevel.INFO);
            
            // Update the meetings table
            const [updatedMeeting] = await db
                .update(meetings)
                .set({
                    checkedIn: checkedIn + 1
                })
                .where(eq(meetings.id, foundMeeting.id))
                .returning();

            // Update the status of ALL properties owned by this shareholder for the current meeting
            await logToFile("checkin", "Updating property check-in status", LogLevel.INFO);
            
            // Now mark all of this shareholder's properties as checked in
            await db
                .update(properties)
                .set({
                    checkedIn: true
                })
                .where(eq(properties.shareholderId, shareholderId));

            // Fetch the shareholder data with properties for the response
            const shareholderWithProperties = await db
                .select()
                .from(shareholders)
                .where(eq(shareholders.shareholderId, shareholderId));
                
            const propertiesForShareholder = await db
                .select()
                .from(properties)
                .where(eq(properties.shareholderId, shareholderId));

            // Log success without exposing the full data
            await logToFile("checkin", "Check-in successful", LogLevel.INFO, {
                propertyCount: propertiesForShareholder.length,
                meetingYear: updatedMeeting.year
            });

            // Prepare response with minimal info needed
            const response = {
                success: true,
                message: "Check-in successful",
                meeting: {
                    id: updatedMeeting.id,
                    year: updatedMeeting.year,
                    total_shareholders: updatedMeeting.totalShareholders,
                    checked_in: updatedMeeting.checkedIn
                },
                shareholder: {
                    id: shareholderId,
                    // Avoid exposing full details in response logs
                },
                propertyCount: propertiesForShareholder.length
            };
            
            await logToFile("checkin", "Sending success response", LogLevel.INFO);
            return NextResponse.json(response);
        }
    } catch (error) {
        await logToFile("checkin", "Error processing check-in", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });
        
        return NextResponse.json(
            { error: "An error occurred during check-in" },
            { status: 500 }
        );
    }
}
