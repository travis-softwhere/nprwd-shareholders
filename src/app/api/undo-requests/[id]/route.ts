import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { undoRequests, properties, shareholders } from "@/lib/db/schema";
import { logToFile, LogLevel } from "@/utils/logger";
import { eq, and } from "drizzle-orm";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("undo-requests", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins can approve/reject requests
        if (!session.user.isAdmin) {
            await logToFile("undo-requests", "Non-admin access attempt", LogLevel.WARNING, {
                user: session.user.email
            });
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const resolvedParams = await params;
        const requestId = parseInt(resolvedParams.id);
        const body = await request.json();
        const { action } = body; // 'approve' or 'reject'

        if (!action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: "Action must be 'approve' or 'reject'" },
                { status: 400 }
            );
        }

        // Get the undo request
        const [undoRequest] = await db
            .select()
            .from(undoRequests)
            .where(eq(undoRequests.id, requestId));

        if (!undoRequest) {
            return NextResponse.json(
                { error: "Undo request not found" },
                { status: 404 }
            );
        }

        if (undoRequest.status !== 'pending') {
            return NextResponse.json(
                { error: "Request has already been processed" },
                { status: 400 }
            );
        }

        const adminUser = session.user.email || session.user.name || "Unknown";

        if (action === 'approve') {
            // Update the undo request status
            await db
                .update(undoRequests)
                .set({
                    status: 'approved',
                    approvedBy: adminUser,
                    approvedAt: new Date(),
                })
                .where(eq(undoRequests.id, requestId));

            // Actually undo the check-in
            await db
                .update(properties)
                .set({ checkedIn: false })
                .where(eq(properties.shareholderId, undoRequest.shareholderId));

            await db
                .update(shareholders)
                .set({
                    checkedIn: false,
                    checkedInAt: null,
                    signatureImage: null,
                    signatureHash: null
                })
                .where(eq(shareholders.shareholderId, undoRequest.shareholderId));

            await logToFile("undo-requests", "Undo request approved and executed", LogLevel.INFO, {
                requestId,
                shareholderId: undoRequest.shareholderId,
                approvedBy: adminUser
            });

            return NextResponse.json({
                success: true,
                message: "Undo request approved and check-in undone successfully"
            });

        } else if (action === 'reject') {
            // Update the undo request status
            await db
                .update(undoRequests)
                .set({
                    status: 'rejected',
                    approvedBy: adminUser,
                    approvedAt: new Date(),
                })
                .where(eq(undoRequests.id, requestId));

            await logToFile("undo-requests", "Undo request rejected", LogLevel.INFO, {
                requestId,
                shareholderId: undoRequest.shareholderId,
                rejectedBy: adminUser
            });

            return NextResponse.json({
                success: true,
                message: "Undo request rejected"
            });
        }

    } catch (error) {
        await logToFile("undo-requests", "Error processing undo request", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        });

        return NextResponse.json(
            { error: "Failed to process undo request" },
            { status: 500 }
        );
    }
}
