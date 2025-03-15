import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { sendResetEmail } from "@/utils/emailService";
import { logToFile, LogLevel } from "@/utils/logger";

export async function POST(request: Request) {
  try {
    // Parse the JSON body (expecting userId and email)
    const { userId, email } = await request.json();
    if (!userId || !email) {
      return NextResponse.json(
        { error: "User ID and email are required" },
        { status: 400 }
      );
    }

    // Generate a JWT token valid for 2 hours containing the email
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2h" });

    // Let the email service handle the URL construction
    await sendResetEmail(email, token);
    
    // Log without exposing the email address
    await logToFile("password-reset", "Password reset email initiated", LogLevel.INFO, {
      emailDomain: email.split('@')[1], // Only log domain part
    });
    
    return NextResponse.json({ success: true, message: "Reset email sent" });
  } catch (error: any) {
    await logToFile("password-reset", "Error initiating password reset", LogLevel.ERROR, {
      error: error.message || "Unknown error",
    });
    
    return NextResponse.json(
      { error: error.message || "Failed to initiate reset" },
      { status: 500 }
    );
  }
}
