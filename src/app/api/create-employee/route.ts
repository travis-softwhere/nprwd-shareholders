// Api route for creating a new employee

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendResetEmail } from "@/utils/emailService";
import jwt from "jsonwebtoken";
import { safeConsole, logToFile, LogLevel } from "@/utils/logger";

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

    // Generate a JWT token for the new user to set their password
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }
    
    // Log that we're about to send the email
    safeConsole.log(`Creating set-password token for new user: ${email}`);
    logToFile(LogLevel.INFO, `Creating account and sending email for: ${email}`);
    
    // Create a token with "set-new-password" prefix to indicate this is for a new account
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "48h" });
    
    // Send password setup email using the token with a special prefix
    try {
      await sendResetEmail(email, `set-new-password:${token}`);
      safeConsole.log(`Password setup email sent successfully to ${email}`);
      logToFile(LogLevel.INFO, `Password setup email sent to: ${email}`);
    } catch (emailError) {
      // Log the error but don't fail the request
      safeConsole.error(`Failed to send password setup email to ${email}:`, emailError);
      logToFile(LogLevel.ERROR, `Failed to send password setup email to ${email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
    }

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
    const errorMessage = error instanceof Error ? error.message : "Failed to create employee";
    safeConsole.error("Error creating employee:", errorMessage);
    logToFile(LogLevel.ERROR, `Error creating employee: ${errorMessage}`);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}