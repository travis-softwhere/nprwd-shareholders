import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        // Check if user is authenticated and is an admin
        const session = await getServerSession(authOptions);
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get Keycloak admin client
        const adminClient = await authenticateAdmin();
        if (!adminClient) {
            return NextResponse.json(
                { error: "Failed to authenticate with Keycloak" },
                { status: 500 }
            );
        }

        // Get all users
        const users = await adminClient.users.find();

        // Map users to a simpler format
        const mappedUsers = users.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            enabled: user.enabled,
        }));

        return NextResponse.json(mappedUsers);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch users" },
            { status: 500 }
        );
    }
} 