import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";
import { logToFile, LogLevel } from "@/utils/logger";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function DELETE(
    request: Request,
    context: RouteContext
) {
    try {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            await logToFile("users", "Unauthorized delete attempt", LogLevel.WARN);
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        // Get the userId from params
        const { userId } = await context.params;
        if (!userId) {
            await logToFile("users", "Missing user ID in delete request", LogLevel.WARN);
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        await logToFile("users", "Deleting user", LogLevel.INFO, { userId });
        const kcAdmin = await authenticateAdmin();
        await kcAdmin.users.del({ 
            id: userId,
            realm: process.env.KEYCLOAK_REALM || "nprwd-dev-realm"
        });

        await logToFile("users", "User deleted successfully", LogLevel.INFO);
        return NextResponse.json({ success: true });
    } catch (error) {
        await logToFile("users", "Error deleting user", LogLevel.ERROR, {
            errorType: error instanceof Error ? error.name : "Unknown error type",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
} 