import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

// Get a single property
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;
        
        await logToFile("properties", "Single property request received", LogLevel.INFO, {
            propertyId: id
        })

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get property
        const [property] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(id)))

        if (!property) {
            await logToFile("properties", "Property not found", LogLevel.ERROR, {
                propertyId: id
            })
            return NextResponse.json({ error: "Property not found" }, { status: 404 })
        }

        await logToFile("properties", "Property fetched successfully", LogLevel.INFO, {
            propertyId: id
        })

        return NextResponse.json(property)
    } catch (error) {
        const resolvedParams = await params;
        const { id } = resolvedParams;
        
        await logToFile("properties", "Error fetching property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId: id
        })

        return NextResponse.json(
            { error: "Failed to fetch property" },
            { status: 500 }
        )
    }
}

// Update a property
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        await logToFile("properties", "Property update request received", LogLevel.INFO, {
            propertyId
        })

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get request body
        const body = await request.json()
        
        // Log the received update data
        await logToFile("properties", "Property update data received", LogLevel.INFO, {
            propertyId,
            updateData: JSON.stringify(body)
        });
        
        // Ensure property exists before updating
        const [existingProperty] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)))
            
        if (!existingProperty) {
            await logToFile("properties", "Property not found for update", LogLevel.ERROR, {
                propertyId
            })
            return NextResponse.json({ error: "Property not found" }, { status: 404 })
        }
        
        // Function to format city/state/zip consistently (CITY STATE ZIP)
        const formatCityStateZip = (value: string): string => {
            if (!value) return '';
            
            // First, remove all commas and normalize existing spaces
            let formatted = value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
            
            // Check if we have a string with no spaces (like MINOTND80000)
            if (!formatted.includes(' ')) {
                // Try to detect common state codes and split accordingly
                const statePatterns = /([A-Z]+)(AK|AL|AR|AZ|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)([0-9]+)/;
                const match = formatted.match(statePatterns);
                
                if (match) {
                    // We found a pattern like MINOTND80000
                    const [_, city, state, zip] = match;
                    formatted = `${city} ${state} ${zip}`;
                }
            }
            
            return formatted;
        };
        
        // Format the update data
        const formattedUpdateData = {
            account: body.account || existingProperty.account,
            shareholderId: body.shareholderId || existingProperty.shareholderId,
            customerName: body.customerName ? body.customerName.trim().toUpperCase() : existingProperty.customerName,
            customerMailingAddress: body.customerMailingAddress ? body.customerMailingAddress.trim().toUpperCase() : existingProperty.customerMailingAddress,
            cityStateZip: body.cityStateZip ? formatCityStateZip(body.cityStateZip) : existingProperty.cityStateZip,
            ownerName: body.ownerName ? body.ownerName.trim().toUpperCase() : existingProperty.ownerName,
            ownerMailingAddress: body.ownerMailingAddress ? body.ownerMailingAddress.trim().toUpperCase() : existingProperty.ownerMailingAddress,
            ownerCityStateZip: body.ownerCityStateZip ? formatCityStateZip(body.ownerCityStateZip) : existingProperty.ownerCityStateZip,
            residentName: body.residentName ? body.residentName.trim().toUpperCase() : existingProperty.residentName,
            residentMailingAddress: body.residentMailingAddress ? body.residentMailingAddress.trim().toUpperCase() : existingProperty.residentMailingAddress,
            residentCityStateZip: body.residentCityStateZip ? formatCityStateZip(body.residentCityStateZip) : existingProperty.residentCityStateZip,
            serviceAddress: body.serviceAddress ? body.serviceAddress.trim().toUpperCase() : existingProperty.serviceAddress,
            numOf: body.numOf ? body.numOf.trim() : existingProperty.numOf,
            // Explicit conversion to boolean to handle any type issues
            checkedIn: body.checkedIn === true
        };
        
        // Log the update attempt with before/after details
        await logToFile("properties", "Property update details", LogLevel.INFO, {
            propertyId,
            previousCheckedIn: existingProperty.checkedIn,
            newCheckedIn: formattedUpdateData.checkedIn,
            formattedUpdateData: JSON.stringify(formattedUpdateData)
        })

        // Update property with explicit checkedIn handling
        const [updatedProperty] = await db
            .update(properties)
            .set(formattedUpdateData)
            .where(eq(properties.id, parseInt(propertyId)))
            .returning()

        await logToFile("properties", "Property updated successfully", LogLevel.INFO, {
            propertyId,
            finalCheckedIn: updatedProperty.checkedIn,
            updatedProperty: JSON.stringify(updatedProperty)
        })

        return NextResponse.json(updatedProperty)
    } catch (error) {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
      
        await logToFile("properties", "Error updating property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId
        })

        return NextResponse.json(
            { error: "Failed to update property" },
            { status: 500 }
        )
    }
}

// Delete a property
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
      
        await logToFile("properties", "Property deletion request received", LogLevel.INFO, {
            propertyId
        })

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Delete property
        const [deletedProperty] = await db
            .delete(properties)
            .where(eq(properties.id, parseInt(propertyId)))
            .returning()

        if (!deletedProperty) {
            await logToFile("properties", "Property not found for deletion", LogLevel.ERROR, {
                propertyId
            })
            return NextResponse.json({ error: "Property not found" }, { status: 404 })
        }

        await logToFile("properties", "Property deleted successfully", LogLevel.INFO, {
            propertyId
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        await logToFile("properties", "Error deleting property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId
        })

        return NextResponse.json(
            { error: "Failed to delete property" },
            { status: 500 }
        )
    }
} 