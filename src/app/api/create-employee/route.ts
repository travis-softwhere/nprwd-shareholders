// Api route for creating a new employee

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { sendResetEmail } from "@/utils/emailService";
import { safeConsole, logToFile, LogLevel } from "@/utils/logger";

// Function to generate a username from full name
function generateUsername(firstName: string, lastName: string): string {
    // Remove special characters and spaces, convert to lowercase
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Generate username: first letter of first name + last name
    return `${cleanFirst.charAt(0)}${cleanLast}`;
}

export async function POST(request: Request) {
    try {
        await logToFile("employees", "Starting create employee request");
        
        // Get the current session
        const session = await auth();
        
        // Log minimal information without exposing sensitive details
        await logToFile("employees", "Request authenticated", LogLevel.INFO, {
            isAuthenticated: !!session?.user,
            isAdmin: !!session?.user?.isAdmin,
        });

        if (!session?.user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify the user is an admin
        if (!session.user.isAdmin) {
            return NextResponse.json({ error: "Not authorized - Admin access required" }, { status: 403 });
        }

        // Get form data
        const data = await request.json();
        const { fullName, email, role } = data;
        
        // Log without exposing full details
        await logToFile("employees", "Processing employee creation request", LogLevel.INFO, {
            hasEmail: !!email,
            hasFullName: !!fullName,
            hasRole: !!role
        });

        if (!fullName || !email) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Split full name into first and last name
        const [firstName, ...lastNameParts] = fullName.trim().split(' ');
        const lastName = lastNameParts.join(' ');

        if (!firstName || !lastName) {
            return NextResponse.json(
                { error: "Full name must include both first and last name" },
                { status: 400 }
            );
        }

        // Generate username
        const username = generateUsername(firstName, lastName);
        await logToFile("employees", "Username generated successfully");

        // Authenticate with Keycloak using client credentials
        await logToFile("employees", "Authenticating with Keycloak");
        const kcAdmin = await authenticateAdmin();
        await logToFile("employees", "Successfully authenticated with Keycloak");

        // Create user in Keycloak
        await logToFile("employees", "Creating user in Keycloak");
        const user = await kcAdmin.users.create({
            realm: process.env.KEYCLOAK_REALM || "nprwd-dev-realm",
            username: username,
            email: email,
            enabled: true,
            firstName: firstName,
            lastName: lastName,
            attributes: {
                role: [role],
            },
        });
        
        await logToFile("employees", "User created successfully", LogLevel.INFO, {
            success: true,
            // Don't log the actual user ID
        });

        // generate a custom token for setting a new password.
        if (user.id) {
            // Generate a JWT token with a 2-hour expiration
            if (!process.env.JWT_SECRET) {
                throw new Error("JWT_SECRET is not configured");
            }
            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2h" });
            
            // Let the email service handle constructing the URL
            // Just pass in a flag to indicate this is for setting a new password
            const setPasswordToken = `set-new-password:${token}`;
            
            // Send the email with your custom email service
            await sendResetEmail(email, setPasswordToken);
            await logToFile("employees", "Password reset email sent successfully");
        }

        return NextResponse.json({ 
            success: true, 
            userId: user.id,
            username: username 
        });
    } catch (error) {
        await logToFile("employees", "Error creating employee", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            // Don't log stack traces in production
        });
        
        // Determine if it's a permissions error
        const errorMessage = error instanceof Error ? error.message : 'Failed to create employee';
        const isPermissionError = errorMessage.includes('403') || 
                                errorMessage.includes('forbidden') || 
                                errorMessage.includes('permissions');
        
        return NextResponse.json(
            { 
                error: errorMessage,
                hint: isPermissionError ? 
                    "Please ensure the client has 'manage-users' and 'view-users' roles from 'realm-management'" : 
                    undefined 
            },
            { status: isPermissionError ? 403 : 500 }
        );
    }
}