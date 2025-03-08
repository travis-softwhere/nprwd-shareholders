import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    // Ensure we have a valid session
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
    const realm = process.env.KEYCLOAK_REALM || "nprwd-realm";
    
    await kcAdmin.users.executeActionsEmail({
      id: userId,
      realm,
      actions: ["UPDATE_PASSWORD"],
      lifespan: 43200, // Valid for 12 hours
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
