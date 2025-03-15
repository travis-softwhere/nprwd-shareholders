import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";
import { logToFile, LogLevel } from "@/utils/logger";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            await logToFile("users", "Unauthorized users list attempt", LogLevel.WARN);
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        await logToFile("users", "Fetching user list", LogLevel.INFO);
        const kcAdmin = await authenticateAdmin();
        const users = await kcAdmin.users.find();
        
        await logToFile("users", "Users fetched successfully", LogLevel.INFO, {
            userCount: users.length
        });

        // Transform the user data to match our interface
        const employees = users.map(user => ({
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.attributes?.role?.[0],
        }));

        return NextResponse.json(employees);
    } catch (error) {
        await logToFile("users", "Error fetching users", LogLevel.ERROR, {
            errorType: error instanceof Error ? error.name : "Unknown error type",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
} 