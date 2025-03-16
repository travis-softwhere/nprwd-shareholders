import KcAdminClient from '@keycloak/keycloak-admin-client';

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
            throw new Error(data.error_description || 'Failed to authenticate with Keycloak');
        }

        // Set the access token in the admin client
        keycloakAdmin.setAccessToken(data.access_token);

        // Test the connection and permissions
        try {
            // Try to list users as a test
            await keycloakAdmin.users.find({ max: 1 });
    
        } catch (testError) {
           throw new Error('Client lacks required permissions. Please check service account roles.');
        }

        return keycloakAdmin;
    } catch (error) {
        
        if (error instanceof Error) {
            throw new Error(`Keycloak authentication failed: ${error.message}`);
        }
        throw error;
    }
}

// Export the admin client instance
export { keycloakAdmin }; 