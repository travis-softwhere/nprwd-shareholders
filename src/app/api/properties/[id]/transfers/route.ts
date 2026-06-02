import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { properties, propertyTransfers, shareholders } from "@/lib/db/schema"
import { desc, eq, inArray } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"
import { ensurePropertySignatureColumns } from "@/lib/db/ensure-property-signature-columns"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const resolvedParams = await params
        const propertyId = resolvedParams.id

        await logToFile("properties", "Property transfers request received", LogLevel.INFO, {
            propertyId,
        })

        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await ensurePropertySignatureColumns()

        const id = Number.parseInt(propertyId, 10)
        if (!Number.isFinite(id)) {
            return NextResponse.json({ error: "Invalid property id" }, { status: 400 })
        }

        const [property] = await db
            .select({ id: properties.id })
            .from(properties)
            .where(eq(properties.id, id))

        if (!property) {
            await logToFile("properties", "Property not found for transfer history", LogLevel.ERROR, {
                propertyId,
            })
            return NextResponse.json({ error: "Property not found" }, { status: 404 })
        }

        const rows = await db
            .select({
                id: propertyTransfers.id,
                fromShareholderId: propertyTransfers.fromShareholderId,
                toShareholderId: propertyTransfers.toShareholderId,
                transferredAt: propertyTransfers.transferDate,
                meetingId: propertyTransfers.meetingId,
            })
            .from(propertyTransfers)
            .where(eq(propertyTransfers.propertyId, id))
            .orderBy(desc(propertyTransfers.transferDate))

        const shareholderIds = Array.from(
            new Set(rows.flatMap((row) => [row.fromShareholderId, row.toShareholderId])),
        )

        const nameById = new Map<string, string>()
        if (shareholderIds.length > 0) {
            const shareholderRows = await db
                .select({
                    shareholderId: shareholders.shareholderId,
                    name: shareholders.name,
                })
                .from(shareholders)
                .where(inArray(shareholders.shareholderId, shareholderIds))

            for (const sh of shareholderRows) {
                nameById.set(sh.shareholderId, sh.name?.trim() || sh.shareholderId)
            }
        }

        const resolveName = (shareholderId: string) =>
            nameById.get(shareholderId) || shareholderId

        const transfers = rows.map((row) => ({
            id: row.id,
            fromShareholder: {
                id: row.fromShareholderId,
                name: resolveName(row.fromShareholderId),
            },
            toShareholder: {
                id: row.toShareholderId,
                name: resolveName(row.toShareholderId),
            },
            transferredAt: row.transferredAt,
            meetingId: row.meetingId,
        }))

        await logToFile("properties", "Property transfers fetched successfully", LogLevel.INFO, {
            propertyId,
            transfersCount: transfers.length,
        })

        return NextResponse.json({ transfers })
    } catch (error) {
        const resolvedParams = await params
        const propertyId = resolvedParams.id

        await logToFile("properties", "Error fetching property transfers", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId,
        })

        return NextResponse.json(
            { error: "Failed to fetch property transfers" },
            { status: 500 },
        )
    }
}
