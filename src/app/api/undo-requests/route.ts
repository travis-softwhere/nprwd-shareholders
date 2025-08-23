import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { undoRequests } from "@/lib/db/schema";
import { logToFile, LogLevel } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("undo-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { shareholderId, shareholderName, reason } = body;

        if (!shareholderId || !shareholderName) {
            return NextResponse.json(
                { error: "Shareholder ID and name are required" },
                { status: 400 }
            );
        }

        // Create new undo request
        const newRequest = await db.insert(undoRequests).values({
            shareholderId,
            shareholderName,
            requestedBy: session.user.email || session.user.name || "Unknown",
            reason: reason || null,
        }).returning();

        await logToFile("undo-requests", "New undo request created", LogLevel.INFO, {
            shareholderId,
            requestedBy: session.user.email,
            requestId: newRequest[0].id
        });

        return NextResponse.json({
            success: true,
            message: "Undo request submitted successfully",
            request: newRequest[0]
        });

    } catch (error) {
        await logToFile("undo-requests", "Error creating undo request", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to create undo request" },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("undo-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins can view undo requests
        if (!session.user.isAdmin) {
            await logToFile("undo-requests", "Non-admin access attempt", LogLevel.WARNING, {
                user: session.user.email
            });
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status");

        let query = db.select().from(undoRequests).orderBy(undoRequests.requestedAt);

        if (status) {
            query = query.where(eq(undoRequests.status, status));
        }

        const requests = await query;

        return NextResponse.json({
            success: true,
            requests
        });

    } catch (error) {
        await logToFile("undo-requests", "Error fetching undo requests", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to fetch undo requests" },
            { status: 500 }
        );
    }
}
