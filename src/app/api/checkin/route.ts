import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, properties, shareholders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        console.log("Check-in API called");
        
        // Parse the request body expecting a shareholderId string.
        const { shareholderId } = await request.json();
        console.log("Received shareholderId:", shareholderId);
        
        if(!shareholderId){
            console.log("Error: No shareholderId provided");
            return NextResponse.json({ error: "shareholderId is required" }, { status: 400 });
        }

        // First get the shareholder record to get the meetingId
        const [foundShareholder] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, shareholderId));

        console.log("Found shareholder:", foundShareholder);

        if (!foundShareholder) {
            console.log("Error: Shareholder not found");
            return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
        }

        // Now get the meeting record using the meetingId from the shareholder
        const [foundMeeting] = await db
            .select()
            .from(meetings)
            .where(eq(meetings.id, Number(foundShareholder.meetingId)));

        console.log("Found meeting:", foundMeeting);

        if (!foundMeeting) {
            console.log("Error: Meeting not found");
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        // TODO: If we later decide to store an individual check-in flag on the shareholder record,
        // we can update this variable to check that flag instead of defaulting to false.
        // For now, we'll allow multiple check-ins as we're only tracking the total count.
        let wasAlreadyCheckedIn = false;

        // Get safe values (if any field might be null)
        const totalShareholders = foundMeeting.totalShareholders ?? 0;
        console.log("Total shareholders:", totalShareholders);

        // If the meeting is not already at maximum attendance and the shareholder wasn't already checked in, increment.
        if (!wasAlreadyCheckedIn) {
            console.log("Updating meeting check-in count");
            // Using SQL helper to atomically increment checkedIn count
            // This ensures the increment happens in a single atomic operation
            // Avoiding potential race conditions
            await db 
                .update(meetings)
                .set({ 
                    checkedIn: sql`LEAST(COALESCE(${meetings.checkedIn}, 0) + 1, ${totalShareholders})`
                })
                .where(eq(meetings.id, Number(foundShareholder.meetingId)));
        }

        console.log("Updating properties check-in status");
        // Update the checkedIn status in the properties table
        await db
            .update(properties)
            .set({ checkedIn: true })
            .where(eq(properties.shareholderId, shareholderId));

        // Re-fetch the updated records.
        const [updatedShareholder] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, shareholderId));

        const [updatedMeeting] = await db
            .select()
            .from(meetings)
            .where(eq(meetings.id, Number(updatedShareholder.meetingId)));

        console.log("Updated meeting:", updatedMeeting);

        // Return the updated meeting data in the format expected by the frontend
        const response = {
            meeting: {
                total_shareholders: updatedMeeting.totalShareholders,
                checked_in: updatedMeeting.checkedIn
            },
            message: "Successfully checked in"
        };
        console.log("Sending response:", response);
        return NextResponse.json(response);
    } catch (error) {
        console.error("Error in checkin:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
