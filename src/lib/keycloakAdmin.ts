import KcAdminClient from '@keycloak/keycloak-admin-client';
import { logToFile, LogLevel } from "@/utils/logger";

/**
 * Keycloak Admin Client Configuration
 * 
 * This file configures the connection to Keycloak for administrative operations.
 * Admin verification is now based on the 'realm-admin' role in Keycloak rather than
 * a custom attribute. Make sure to assign this role to users who need administrative access.
 * 
 * For production, ensure you're using valid SSL certificates instead of disabling verification.
 */

// In development, we'll log a warning but not disable certificate verification
if (process.env.NODE_ENV === 'development') {
    // Instead of disabling TLS verification, we log a warning
    logToFile("security", "Running in development mode. Ensure valid SSL certificates are used in production.", LogLevel.WARN);
}

// Check required environment variables
const requiredEnvVars = {
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER,
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM,
    KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET,
} as const;

// Validate environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
});

// Extract base URL and realm from issuer
const issuerUrl = new URL(requiredEnvVars.KEYCLOAK_ISSUER as string);
const realmName = process.env.KEYCLOAK_REALM; // Directly use the realm name from .env 

// Initialize the Keycloak admin client
const keycloakAdmin = new KcAdminClient({
    baseUrl: issuerUrl.origin,
    realmName: realmName,
});

// Function to authenticate the admin client using client credentials
export async function authenticateAdmin() {
    try {
        await logToFile("keycloak", "Authenticating admin client", LogLevel.INFO);
        
        const tokenEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
        
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.KEYCLOAK_CLIENT_ID!,
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            await logToFile("keycloak", "Authentication failed", LogLevel.ERROR, {
                error: data.error_description || "Unknown error"
            });
            throw new Error(data.error_description || 'Failed to authenticate with Keycloak');
        }

        // Set the access token in the admin client
        keycloakAdmin.setAccessToken(data.access_token);

        // Test the connection and permissions
        try {
            // Try to list users as a test
            await keycloakAdmin.users.find({ max: 1 });
            await logToFile("keycloak", "Authentication successful with sufficient permissions", LogLevel.INFO);
        } catch (testError) {
            await logToFile("keycloak", "Permission error after authentication", LogLevel.ERROR, {
                errorMessage: testError instanceof Error ? testError.message : "Unknown error"
            });
            throw new Error('Client lacks required permissions. Please check service account roles.');
        }

        return keycloakAdmin;
    } catch (error) {
        await logToFile("keycloak", "Authentication error", LogLevel.ERROR, {
            errorType: error instanceof Error ? error.name : "Unknown error type",
            errorMessage: error instanceof Error ? error.message : "Unknown error"
        });
        if (error instanceof Error) {
            throw new Error(`Keycloak authentication failed: ${error.message}`);
        }
        throw error;
    }
}

// Export the admin client instance
export { keycloakAdmin }; 