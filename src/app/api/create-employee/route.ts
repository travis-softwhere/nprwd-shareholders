// Api route for creating a new employee

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Check if user is authenticated and is an admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { fullName, email } = await request.json();
    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    // Get Keycloak admin client
    const adminClient = await authenticateAdmin();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Failed to authenticate with Keycloak" },
        { status: 500 }
      );
    }

    // Split full name into first and last name
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    // Generate username from email
    const username = email.split("@")[0];

    // Create user in Keycloak
    const user = await adminClient.users.create({
      username,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [
        {
          type: "password",
          value: Math.random().toString(36).slice(-8),
          temporary: true,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username,
        email,
        firstName,
        lastName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create employee" },
      { status: 500 }
    );
  }
}