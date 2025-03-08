import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";

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
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        // Get the userId from params
        const { userId } = await context.params;
        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const kcAdmin = await authenticateAdmin();
        await kcAdmin.users.del({ 
            id: userId,
            realm: process.env.KEYCLOAK_REALM || "nprwd-realm"
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
} 