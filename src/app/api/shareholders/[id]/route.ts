import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { id } = await context.params
        const name = typeof body?.name === "string" ? body.name.trim() : undefined
        const ownerMailingAddress =
            typeof body?.ownerMailingAddress === "string" ? body.ownerMailingAddress.trim() : undefined
        const ownerCityStateZip =
            typeof body?.ownerCityStateZip === "string" ? body.ownerCityStateZip.trim() : undefined

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 })
        }

        await db
            .update(shareholders)
            .set({
                name: name.toUpperCase(),
                ...(ownerMailingAddress !== undefined ? { ownerMailingAddress } : {}),
                ...(ownerCityStateZip !== undefined ? { ownerCityStateZip } : {}),
            })
            .where(eq(shareholders.shareholderId, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error updating shareholder:", error)
        return NextResponse.json({ error: "Failed to update shareholder" }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { id } = await context.params

        await db.delete(properties).where(eq(properties.shareholderId, id))
        await db.delete(shareholders).where(eq(shareholders.shareholderId, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting shareholder:", error)
        return NextResponse.json({ error: "Failed to delete shareholder" }, { status: 500 })
    }
}
