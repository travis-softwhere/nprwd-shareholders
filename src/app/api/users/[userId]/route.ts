import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Next.js specifically expects params to be a Promise
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        // Check if user is authenticated and is an admin
        const session = await getServerSession(authOptions);
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;
        const { userId } = resolvedParams;
        
        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Get Keycloak admin client
        const adminClient = await authenticateAdmin();
        if (!adminClient) {
            return NextResponse.json(
                { error: "Failed to authenticate with Keycloak" },
                { status: 500 }
            );
        }

        // Delete the user
        await adminClient.users.del({ id: userId });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete user" },
            { status: 500 }
        );
    }
} 