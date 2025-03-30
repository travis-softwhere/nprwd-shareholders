import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { propertyTransfers, shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        await logToFile("properties", "Property transfer history request received", LogLevel.INFO, {
            propertyId: params.id
        })

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get transfer history with related data
        const transfers = await db
            .select({
                id: propertyTransfers.id,
                fromShareholder: {
                    id: shareholders.shareholderId,
                    name: shareholders.name
                },
                toShareholder: {
                    id: shareholders.shareholderId,
                    name: shareholders.name
                },
                transferredAt: propertyTransfers.transferredAt,
                transferredBy: propertyTransfers.transferredBy
            })
            .from(propertyTransfers)
            .leftJoin(shareholders, eq(propertyTransfers.fromShareholderId, shareholders.shareholderId))
            .leftJoin(shareholders, eq(propertyTransfers.toShareholderId, shareholders.shareholderId))
            .where(eq(propertyTransfers.propertyId, parseInt(params.id)))
            .orderBy(propertyTransfers.transferredAt)

        await logToFile("properties", "Property transfer history retrieved successfully", LogLevel.INFO, {
            propertyId: params.id,
            transferCount: transfers.length
        })

        return NextResponse.json(transfers)
    } catch (error) {
        await logToFile("properties", "Error fetching property transfer history", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId: params.id
        })

        return NextResponse.json(
            { error: "Failed to fetch property transfer history" },
            { status: 500 }
        )
    }
} 