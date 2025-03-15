import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";
import { logToFile, LogLevel } from "@/utils/logger";

// Next.js specifically expects params to be a Promise
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            await logToFile("users", "Unauthorized delete attempt", LogLevel.WARN);
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        // Resolve the params promise to get userId
        const resolvedParams = await params;
        const { userId } = resolvedParams;
        
        if (!userId) {
            await logToFile("users", "Missing user ID in delete request", LogLevel.WARN);
            return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
        }

        await logToFile("users", "Deleting user", LogLevel.INFO, { userId });

        // Add your user deletion logic here
        const kcAdmin = await authenticateAdmin();
        await kcAdmin.users.del({ 
            id: userId,
            realm: process.env.KEYCLOAK_REALM || "nprwd-dev-realm"
        });

        await logToFile("users", "User deleted successfully", LogLevel.INFO);
        return NextResponse.json({ success: true });
    } catch (error) {
        await logToFile("users", "Error deleting user", LogLevel.ERROR, {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
} 