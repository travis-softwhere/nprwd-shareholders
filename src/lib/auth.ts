import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import type { JWT } from "next-auth/jwt"
import { getServerSession } from "next-auth/next"

async function validateCredentials(username: string, password: string) {
    try {
        const tokenEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`
        
        const response = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "password",
                client_id: process.env.KEYCLOAK_CLIENT_ID!,
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
                username,
                password,
                scope: "openid email profile",
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            if (data.error === "invalid_grant" && data.error_description === "Account is not fully set up") {
                throw new Error(
                    "Your account setup is incomplete. Please log into the admin portal to complete your profile (Last name required).",
                )
            }
            throw new Error(data.error_description || "Authentication failed")
        }

        // Get user info from access token
        const userInfoResponse = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`, {
            headers: {
                Authorization: `Bearer ${data.access_token}`,
            },
        })

        if (!userInfoResponse.ok) {
            throw new Error("Failed to fetch user info")
        }

        const userInfo = await userInfoResponse.json()

        // Check if the user has isAdmin attribute in userInfo
        let isAdmin = userInfo.isAdmin === "true";
        
        // If isAdmin attribute is not present, check for realm-admin role in the access token
        if (isAdmin === false) {
            try {
                // Parse the JWT token to get roles
                const tokenParts = data.access_token.split('.');
                if (tokenParts.length === 3) {
                    const tokenPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    
                    // Check for realm-admin role in resource_access
                    if (tokenPayload.resource_access && 
                        tokenPayload.resource_access["realm-management"] && 
                        tokenPayload.resource_access["realm-management"].roles) {
                        isAdmin = tokenPayload.resource_access["realm-management"].roles.includes("realm-admin");
                    }
                }
            } catch (error) {
                // Simplified error handling without logging details
            }
        }

        return {
            id: userInfo.sub,
            name: userInfo.name,
            email: userInfo.email,
            isAdmin: isAdmin,
        }
    } catch (error) {
        // Simplified error handling without exposing details
        throw error
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials: Record<"username" | "password", string> | undefined) {
                try {
                    if (!credentials?.username || !credentials?.password) {
                        throw new Error("Please enter both username and password")
                    }

                    const user = await validateCredentials(credentials.username, credentials.password)
                    return user
                } catch (error: any) {
                    // Simplified error handling
                    throw error
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: any }) {
            if (user) {
                token.id = user.id
                token.email = user.email
                token.isAdmin = user.isAdmin
            }
            return token
        },
        async session({ session, token }: { session: any; token: JWT }) {
            if (token && session.user) {
                session.user.id = token.id as string
                session.user.isAdmin = token.isAdmin
            }
            return session
        },
    },
    events: {
        async signIn({ user }: { user: any }) {
            // Removed console log for sign-in event
        },
    },
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    session: {
        strategy: "jwt",
    },
}

export const auth = () => getServerSession(authOptions)