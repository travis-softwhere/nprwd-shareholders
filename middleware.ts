import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token as { isAdmin?: boolean } | null
        
        // Debug logging for middleware
        console.log("Middleware token:", {
            pathname: req.nextUrl.pathname,
            hasToken: !!token,
            isAdmin: token?.isAdmin,
            tokenContents: JSON.stringify(token)
        });

        if (req.nextUrl.pathname.startsWith("/admin")) {
            if (!token?.isAdmin) {
                console.log("Redirecting from admin page - isAdmin not true");
                return NextResponse.redirect(new URL("/", req.url))
            }
            console.log("Allowing access to admin page - isAdmin is true");
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => {
                console.log("Middleware authorization callback - token exists:", !!token);
                return !!token;
            },
        },
    },
)

export const config = {
    matcher: ["/admin/:path*", "/shareholders/:path*"],
}