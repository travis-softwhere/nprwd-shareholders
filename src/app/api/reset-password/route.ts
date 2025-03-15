import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { authenticateAdmin, keycloakAdmin } from "@/lib/keycloakAdmin";
import { logToFile, LogLevel } from "@/utils/logger";

type RequestBody = {
  token: string;
  newPassword: string;
};

export async function POST(request: Request) {
  try {
    // Parse the JSON body from the request
    const { token, newPassword } = (await request.json()) as RequestBody;
    
    // Log the action without the actual token
    await logToFile("password-reset", "Processing password reset request", LogLevel.INFO, {
      hasToken: !!token,
      hasNewPassword: !!newPassword,
    });
    
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Missing token or new password" },
        { status: 400 }
      );
    }

    // If the token looks like a full URL, extract only the token query parameter
    let rawToken = token;
    if (rawToken.startsWith("http://") || rawToken.startsWith("https://")) {
      const parsedUrl = new URL(rawToken);
      rawToken = parsedUrl.searchParams.get("token") || rawToken;
      await logToFile("password-reset", "Extracted token from URL");
    }

    // Verify the token using the secret
    let payload;
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
      }
      payload = jwt.verify(rawToken, process.env.JWT_SECRET);
      await logToFile("password-reset", "Token verified successfully");
    } catch (error) {
      await logToFile("password-reset", "Invalid token", LogLevel.ERROR);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Extract the email from the token payload
    const { email } = payload as { email: string };
    if (!email) {
      await logToFile("password-reset", "Invalid token payload", LogLevel.ERROR);
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });
    }

    // Authenticate with Keycloak Admin
    const adminClient = await authenticateAdmin();
    if (!adminClient) {
      await logToFile("password-reset", "Failed to authenticate with Keycloak", LogLevel.ERROR);
      return NextResponse.json(
        { error: "Failed to authenticate with Keycloak" },
        { status: 500 }
      );
    }

    // Find the user by email
    const users = await adminClient.users.find({ email: email });
    if (!users || users.length === 0) {
      await logToFile("password-reset", "No user found with the provided email", LogLevel.ERROR);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Reset the password for the user
    const userId = users[0].id;
    if (!userId) {
      await logToFile("password-reset", "User found but ID is missing", LogLevel.ERROR);
      return NextResponse.json(
        { error: "Invalid user record" },
        { status: 500 }
      );
    }

    await adminClient.users.resetPassword({
      id: userId,
      realm: process.env.KEYCLOAK_REALM!,
      credential: {
        temporary: false,
        type: "password",
        value: newPassword,
      },
    });

    await logToFile("password-reset", "Password reset successful", LogLevel.INFO, {
      emailDomain: email.split('@')[1], // Only log domain part for privacy
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await logToFile("password-reset", "Error resetting password", LogLevel.ERROR, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset password" },
      { status: 500 }
    );
  }
}
