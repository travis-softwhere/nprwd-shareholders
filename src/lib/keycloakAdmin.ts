import KcAdminClient from '@keycloak/keycloak-admin-client';

// In development, allow self-signed certificates
if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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

// Log configuration for debugging
console.log('Keycloak configuration:', {
    baseUrl: issuerUrl.origin,
    realmName: realmName,
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    // Log a few characters of the secret to verify it's set
    clientSecretPreview: process.env.KEYCLOAK_CLIENT_SECRET?.substring(0, 4) + '...',
    fullUrl: process.env.KEYCLOAK_ISSUER
});

// Initialize the Keycloak admin client
const keycloakAdmin = new KcAdminClient({
    baseUrl: issuerUrl.origin,
    realmName: realmName,
});

// Function to authenticate the admin client using client credentials
export async function authenticateAdmin() {
    try {
        console.log('Attempting to authenticate with client credentials');
        console.log('Base URL:', issuerUrl.origin);
        console.log('Realm:', realmName);
        
        const tokenEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
        console.log('Token endpoint:', tokenEndpoint);

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
        console.log('Keycloak response status:', response.status);
        
        if (!response.ok) {
            console.error('Authentication failed:', data);
            throw new Error(data.error_description || 'Failed to authenticate with Keycloak');
        }

        console.log('Successfully obtained access token');

        // Set the access token in the admin client
        keycloakAdmin.setAccessToken(data.access_token);

        // Test the connection and permissions
        try {
            console.log('Testing connection and permissions...');
            // Try to list users as a test
            await keycloakAdmin.users.find({ max: 1 });
            console.log('Successfully verified permissions');
        } catch (testError) {
            console.error('Permission test failed:', testError);
            throw new Error('Client lacks required permissions. Please check service account roles.');
        }

        return keycloakAdmin;
    } catch (error) {
        console.error('Failed to authenticate Keycloak admin client:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
            });
        }
        throw error;
    }
}

// Export the admin client instance
export { keycloakAdmin }; 