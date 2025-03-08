import { DrizzleAdapter } from "@auth/drizzle-adapter"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import type { JWT } from "next-auth/jwt"
import { getServerSession } from "next-auth/next"

async function validateCredentials(username: string, password: string) {
    try {
        console.log(`Attempting to authenticate user: ${username}`)
        console.log(`Keycloak issuer URL: ${process.env.KEYCLOAK_ISSUER}`)

        const tokenEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`
        console.log("Token endpoint:", tokenEndpoint)

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
        console.log("Keycloak response status:", response.status)
        console.log("Keycloak response:", JSON.stringify(data, null, 2))

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
            console.error("Failed to fetch user info:", await userInfoResponse.text())
            throw new Error("Failed to fetch user info")
        }

        const userInfo = await userInfoResponse.json()
        console.log("User info:", JSON.stringify(userInfo, null, 2))

        return {
            id: userInfo.sub,
            name: userInfo.name,
            email: userInfo.email,
            isAdmin: userInfo.isAdmin === "true",
        }
    } catch (error) {
        console.error("Error in validateCredentials:", error)
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
                    console.error("Error in authorize:", error)
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
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    session: {
        strategy: "jwt",
    },
}

export const auth = () => getServerSession(authOptions)