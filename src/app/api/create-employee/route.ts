// Api route for creating a new employee

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";

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
        console.log('Starting create employee request...');
        
        // Get the current session
        const session = await auth();
        console.log('Session:', {
            authenticated: !!session?.user,
            isAdmin: session?.user?.isAdmin,
            userId: session?.user?.id
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
        console.log('Received form data:', { fullName, email, role });

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
        console.log('Generated username:', username);

        console.log('Authenticating with Keycloak...');
        // Authenticate with Keycloak using client credentials
        const kcAdmin = await authenticateAdmin();
        console.log('Successfully authenticated with Keycloak');

        // Create user in Keycloak
        console.log('Creating user in Keycloak...');
        const user = await kcAdmin.users.create({
            realm: "nprwd-realm",
            username: username,
            email: email,
            enabled: true,
            firstName: firstName,
            lastName: lastName,
            attributes: {
                role: [role],
            },
        });
        console.log('Successfully created user:', user.id);

        // Send password reset email
        if (user.id) {
            console.log('Sending password reset email...');
            await kcAdmin.users.executeActionsEmail({
                realm: "nprwd-realm",
                id: user.id,
                actions: ["UPDATE_PASSWORD"],
            });
            console.log('Successfully sent password reset email');
        }

        return NextResponse.json({ 
            success: true, 
            userId: user.id,
            username: username 
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
            });
        }
        
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