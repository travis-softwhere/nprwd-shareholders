import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminRequests } from "@/lib/db/schema";
import { logToFile, LogLevel } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("admin-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins can complete/reject requests
        if (!session.user.isAdmin) {
            await logToFile("admin-requests", "Non-admin access attempt", LogLevel.WARN, {
                user: session.user.email
            });
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const resolvedParams = await params;
        const requestId = parseInt(resolvedParams.id);
        const body = await request.json();
        const { action } = body; // 'complete' or 'reject'

        if (!action || !['complete', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: "Action must be 'complete' or 'reject'" },
                { status: 400 }
            );
        }

        // Get the admin request
        const [adminRequest] = await db
            .select()
            .from(adminRequests)
            .where(eq(adminRequests.id, requestId));

        if (!adminRequest) {
            return NextResponse.json(
                { error: "Admin request not found" },
                { status: 404 }
            );
        }

        if (adminRequest.status !== 'pending') {
            return NextResponse.json(
                { error: "Request has already been processed" },
                { status: 400 }
            );
        }

        const adminUser = session.user.email || session.user.name || "Unknown";

        if (action === 'complete') {
            // Update the admin request status
            await db
                .update(adminRequests)
                .set({
                    status: 'completed',
                    completedBy: adminUser,
                    completedAt: new Date(),
                })
                .where(eq(adminRequests.id, requestId));

            await logToFile("admin-requests", "Admin request completed", LogLevel.INFO, {
                requestId,
                shareholderId: adminRequest.shareholderId,
                completedBy: adminUser
            });

            return NextResponse.json({
                success: true,
                message: "Admin request completed successfully"
            });

        } else if (action === 'reject') {
            // Update the admin request status
            await db
                .update(adminRequests)
                .set({
                    status: 'rejected',
                    completedBy: adminUser,
                    completedAt: new Date(),
                })
                .where(eq(adminRequests.id, requestId));

            await logToFile("admin-requests", "Admin request rejected", LogLevel.INFO, {
                requestId,
                shareholderId: adminRequest.shareholderId,
                rejectedBy: adminUser
            });

            return NextResponse.json({
                success: true,
                message: "Admin request rejected successfully"
            });
        }

    } catch (error) {
        await logToFile("admin-requests", "Error processing admin request", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to process admin request" },
            { status: 500 }
        );
    }
}
