import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { properties, propertyTransfers, shareholders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

// Get transfer history for a property
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        await logToFile("properties", "Property transfers request received", LogLevel.INFO, {
            propertyId
        });

        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Make sure property exists
        const [property] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)));

        if (!property) {
            await logToFile("properties", "Property not found for transfer history", LogLevel.ERROR, {
                propertyId
            });
            return NextResponse.json({ error: "Property not found" }, { status: 404 });
        }

        // Get transfer history
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
            .where(eq(propertyTransfers.propertyId, parseInt(propertyId)))
            .orderBy(propertyTransfers.transferredAt)

        await logToFile("properties", "Property transfers fetched successfully", LogLevel.INFO, {
            propertyId,
            transfersCount: transfers.length
        });

        return NextResponse.json({ transfers });
    } catch (error) {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        await logToFile("properties", "Error fetching property transfers", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId
        });

        return NextResponse.json(
            { error: "Failed to fetch property transfers" },
            { status: 500 }
        );
    }
} 