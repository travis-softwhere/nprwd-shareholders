import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { query, queryOne } from "@/lib/db"
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
        const property = await queryOne<{
            id: number;
            account: string;
            shareholder_id: string;
            service_address: string;
            city_state_zip: string;
            num_of: string;
            owner_name: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            customer_name: string;
            customer_mailing_address: string;
            resident_name: string;
            resident_mailing_address: string;
            resident_city_state_zip: string;
            checked_in: boolean;
            created_at: Date;
        }>(
            'SELECT * FROM properties WHERE id = $1',
            [parseInt(id)]
        );

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
        const existingProperty = await queryOne<{
            id: number;
            account: string;
            shareholder_id: string;
            service_address: string;
            city_state_zip: string;
            num_of: string;
            owner_name: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            customer_name: string;
            customer_mailing_address: string;
            resident_name: string;
            resident_mailing_address: string;
            resident_city_state_zip: string;
            checked_in: boolean;
            created_at: Date;
        }>(
            'SELECT * FROM properties WHERE id = $1',
            [parseInt(propertyId)]
        );
            
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
            shareholder_id: body.shareholderId || existingProperty.shareholder_id,
            customer_name: body.customerName ? body.customerName.trim().toUpperCase() : existingProperty.customer_name,
            customer_mailing_address: body.customerMailingAddress ? body.customerMailingAddress.trim().toUpperCase() : existingProperty.customer_mailing_address,
            city_state_zip: body.cityStateZip ? formatCityStateZip(body.cityStateZip) : existingProperty.city_state_zip,
            owner_name: body.ownerName ? body.ownerName.trim().toUpperCase() : existingProperty.owner_name,
            owner_mailing_address: body.ownerMailingAddress ? body.ownerMailingAddress.trim().toUpperCase() : existingProperty.owner_mailing_address,
            owner_city_state_zip: body.ownerCityStateZip ? formatCityStateZip(body.ownerCityStateZip) : existingProperty.owner_city_state_zip,
            resident_name: body.residentName ? body.residentName.trim().toUpperCase() : existingProperty.resident_name,
            resident_mailing_address: body.residentMailingAddress ? body.residentMailingAddress.trim().toUpperCase() : existingProperty.resident_mailing_address,
            resident_city_state_zip: body.residentCityStateZip ? formatCityStateZip(body.residentCityStateZip) : existingProperty.resident_city_state_zip,
            service_address: body.serviceAddress ? body.serviceAddress.trim().toUpperCase() : existingProperty.service_address,
            num_of: body.numOf ? body.numOf.trim() : existingProperty.num_of,
            // Explicit conversion to boolean to handle any type issues
            checked_in: body.checkedIn === true
        };
        
        // Log the update attempt with before/after details
        await logToFile("properties", "Property update details", LogLevel.INFO, {
            propertyId,
            previousCheckedIn: existingProperty.checked_in,
            newCheckedIn: formattedUpdateData.checked_in,
            formattedUpdateData: JSON.stringify(formattedUpdateData)
        })

        // Update property with explicit checkedIn handling
        const updatedProperty = await queryOne<{
            id: number;
            account: string;
            shareholder_id: string;
            service_address: string;
            city_state_zip: string;
            num_of: string;
            owner_name: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            customer_name: string;
            customer_mailing_address: string;
            resident_name: string;
            resident_mailing_address: string;
            resident_city_state_zip: string;
            checked_in: boolean;
            created_at: Date;
        }>(
            `UPDATE properties SET
                account = $1,
                shareholder_id = $2,
                customer_name = $3,
                customer_mailing_address = $4,
                city_state_zip = $5,
                owner_name = $6,
                owner_mailing_address = $7,
                owner_city_state_zip = $8,
                resident_name = $9,
                resident_mailing_address = $10,
                resident_city_state_zip = $11,
                service_address = $12,
                num_of = $13,
                checked_in = $14
            WHERE id = $15
            RETURNING *`,
            [
                formattedUpdateData.account,
                formattedUpdateData.shareholder_id,
                formattedUpdateData.customer_name,
                formattedUpdateData.customer_mailing_address,
                formattedUpdateData.city_state_zip,
                formattedUpdateData.owner_name,
                formattedUpdateData.owner_mailing_address,
                formattedUpdateData.owner_city_state_zip,
                formattedUpdateData.resident_name,
                formattedUpdateData.resident_mailing_address,
                formattedUpdateData.resident_city_state_zip,
                formattedUpdateData.service_address,
                formattedUpdateData.num_of,
                formattedUpdateData.checked_in,
                parseInt(propertyId)
            ]
        );

        await logToFile("properties", "Property updated successfully", LogLevel.INFO, {
            propertyId,
            finalCheckedIn: updatedProperty?.checked_in,
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
        const deletedProperty = await queryOne<{
            id: number;
            account: string;
            shareholder_id: string;
            service_address: string;
            city_state_zip: string;
            num_of: string;
            owner_name: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            customer_name: string;
            customer_mailing_address: string;
            resident_name: string;
            resident_mailing_address: string;
            resident_city_state_zip: string;
            checked_in: boolean;
            created_at: Date;
        }>(
            'DELETE FROM properties WHERE id = $1 RETURNING *',
            [parseInt(propertyId)]
        );

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