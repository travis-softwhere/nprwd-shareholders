import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Admin POST request received:", new Date().toISOString())

    // Log the request body
    const body = await request.json()
    console.log("Request body:", body)

    // Log the request headers
    const headers = Object.fromEntries(request.headers)
    console.log("Request headers:", headers)

    // For now, just return a success response
    return NextResponse.json({ success: true })
}