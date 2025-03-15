import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token as { isAdmin?: boolean } | null
        
        // Admin route protection
        if (req.nextUrl.pathname.startsWith("/admin")) {
            if (!token?.isAdmin) {
                return NextResponse.redirect(new URL("/", req.url))
            }
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => {
                return !!token;
            },
        },
        pages: {
            signIn: "/auth/signin",
        },
    },
)

// Update matcher to protect all routes except authentication, API, and static assets
// Using a simplified pattern that will definitely catch the root path
export const config = {
    matcher: [
        '/',
        '/((?!api|auth|reset-password|_next/static|_next/image|favicon.ico|logo.png|manifest.json).*)',
    ],
}