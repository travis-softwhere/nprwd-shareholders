import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminRequests } from "@/lib/db/schema";
import { logToFile, LogLevel } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("admin-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { shareholderId, shareholderName, reason } = body;

        if (!shareholderId || !shareholderName || !reason) {
            return NextResponse.json(
                { error: "Shareholder ID, name, and reason are required" },
                { status: 400 }
            );
        }

        // Create new admin request
        const newRequest = await db.insert(adminRequests).values({
            shareholderId,
            shareholderName,
            requestedBy: session.user.email || session.user.name || "Unknown",
            reason,
        }).returning();

        await logToFile("admin-requests", "New admin request created", LogLevel.INFO, {
            shareholderId,
            requestedBy: session.user.email,
            requestId: newRequest[0].id
        });

        return NextResponse.json({
            success: true,
            message: "Admin request submitted successfully",
            request: newRequest[0]
        });

    } catch (error) {
        await logToFile("admin-requests", "Error creating admin request", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to submit admin request" },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("admin-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins can view admin requests
        if (!session.user.isAdmin) {
            await logToFile("admin-requests", "Non-admin access attempt", LogLevel.WARN, {
                user: session.user.email
            });
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status");

        let requests;
        if (status) {
            requests = await db
                .select()
                .from(adminRequests)
                .where(eq(adminRequests.status, status))
                .orderBy(adminRequests.requestedAt);
        } else {
            requests = await db
                .select()
                .from(adminRequests)
                .orderBy(adminRequests.requestedAt);
        }

        return NextResponse.json({
            success: true,
            requests
        });

    } catch (error) {
        await logToFile("admin-requests", "Error fetching admin requests", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to fetch admin requests" },
            { status: 500 }
        );
    }
}
