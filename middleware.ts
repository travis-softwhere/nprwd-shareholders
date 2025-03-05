import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token as { isAdmin?: boolean } | null

        if (req.nextUrl.pathname.startsWith("/admin")) {
            if (!token?.isAdmin) {
                return NextResponse.redirect(new URL("/", req.url))
            }
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    },
)

export const config = {
    matcher: ["/admin/:path*", "/shareholders/:path*"],
}