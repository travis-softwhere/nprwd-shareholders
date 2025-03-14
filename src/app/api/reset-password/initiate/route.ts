import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { sendResetEmail } from "@/utils/emailService";

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
    
    console.log("Password reset email initiated for:", email);
    return NextResponse.json({ success: true, message: "Reset email sent" });
  } catch (error: any) {
    console.error("Error initiating password reset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate reset" },
      { status: 500 }
    );
  }
}
