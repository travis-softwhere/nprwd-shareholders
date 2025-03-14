import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { authenticateAdmin, keycloakAdmin } from "@/lib/keycloakAdmin";

type RequestBody = {
  token: string;
  newPassword: string;
};

export async function POST(request: Request) {
  try {
    // Parse the JSON body from the request
    const { token, newPassword } = (await request.json()) as RequestBody;
    console.log("Received token:", token);
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
      console.log("Extracted raw token:", rawToken);
    }

    // Verify the token using the secret
    let payload;
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
      }
      payload = jwt.verify(rawToken, process.env.JWT_SECRET);
      console.log("Payload:", payload);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Extract the email from the token payload
    const { email } = payload as { email: string };
    if (!email) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });
    }

    // Authenticate with Keycloak Admin
    const adminClient = await authenticateAdmin();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Failed to authenticate with Keycloak Admin" },
        { status: 500 }
      );
    }

    // Find user by email
    if (!process.env.KEYCLOAK_REALM) {
      throw new Error("KEYCLOAK_REALM is not configured");
    }
    const users = await keycloakAdmin.users.find({
      email: email,
      realm: process.env.KEYCLOAK_REALM,
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = users[0].id;

    // Call Keycloak Admin API to reset the password
    await keycloakAdmin.users.resetPassword({
      id: userId as string,
      realm: process.env.KEYCLOAK_REALM || "nprwd-dev-realm",
      credential: {
        temporary: false,
        type: "password",
        value: newPassword,
      },
    });

    return NextResponse.json(
      { 
        message: "Password reset successfully",
        redirectUrl: "/auth/signin"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
