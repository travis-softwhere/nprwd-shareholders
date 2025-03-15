import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Process the request body without logging
    const body = await request.json()
    
    // For now, just return a success response
    return NextResponse.json({ success: true })
}