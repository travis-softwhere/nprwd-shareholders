import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { properties, propertyTransfers, shareholders } from "@/lib/db/schema"
import { eq, sql, count } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Get the property ID safely
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        await logToFile("properties", "Property transfer request received", LogLevel.INFO, {
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
        const { 
            newShareholderId, 
            toShareholderId,
            newOwnerName, 
            newOwnerMailingAddress, 
            newOwnerCityStateZip,
            newCustomerName,
            newCustomerMailingAddress,
            newCustomerCityStateZip,
            newResidentName,
            newResidentMailingAddress,
            newResidentCityStateZip,
            keepExistingCustomer,
            keepExistingService
        } = body

        // Accept either newShareholderId or toShareholderId
        const targetShareholderId = newShareholderId || toShareholderId

        if (!targetShareholderId) {
            return NextResponse.json(
                { error: "New shareholder ID is required" },
                { status: 400 }
            )
        }

        // Get current property
        const [property] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)))

        if (!property) {
            await logToFile("properties", "Property not found for transfer", LogLevel.ERROR, {
                propertyId
            })
            return NextResponse.json({ error: "Property not found" }, { status: 404 })
        }

        // Store the old shareholder ID for later check
        const oldShareholderId = property.shareholderId;

        // Verify the new shareholder exists
        const [newShareholder] = await db
            .select()
            .from(shareholders)
            .where(eq(shareholders.shareholderId, targetShareholderId))

        if (!newShareholder) {
            await logToFile("properties", "Shareholder not found for transfer", LogLevel.ERROR, {
                shareholderId: targetShareholderId
            })
            return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
        }

        // Get the meeting ID from the new shareholder record
        const meetingId = newShareholder.meetingId;
        
        // Try to find existing properties for the new shareholder to get address information
        const existingProperties = await db
            .select()
            .from(properties)
            .where(eq(properties.shareholderId, targetShareholderId));
            
        // Get address information from existing property if available
        let existingOwnerMailingAddress, existingOwnerCityStateZip;
        let existingCustomerMailingAddress, existingCustomerCityStateZip;
        let existingResidentMailingAddress, existingResidentCityStateZip;
        
        if (existingProperties.length > 0) {
            // Use the most recent property for address info
            const existingProperty = existingProperties[0];
            
            existingOwnerMailingAddress = existingProperty.ownerMailingAddress;
            existingOwnerCityStateZip = existingProperty.ownerCityStateZip;
            
            existingCustomerMailingAddress = existingProperty.customerMailingAddress;
            existingCustomerCityStateZip = existingProperty.cityStateZip;
            
            existingResidentMailingAddress = existingProperty.residentMailingAddress;
            existingResidentCityStateZip = existingProperty.residentCityStateZip;
            
            await logToFile("properties", "Found existing properties for new shareholder", LogLevel.INFO, {
                shareholderId: targetShareholderId,
                propertiesCount: existingProperties.length,
                existingPropertyId: existingProperty.id,
                existingOwnerMailingAddress,
                existingCustomerMailingAddress,
                existingResidentMailingAddress
            });
        }

        // Try to record the transfer in our audit log
        const currentDate = new Date();
        try {
            // Include required meeting_id field
            await db.execute(
                sql`INSERT INTO property_transfers 
                (property_id, from_shareholder_id, to_shareholder_id, transfer_date, meeting_id) 
                VALUES 
                (${parseInt(propertyId)}, ${oldShareholderId || "unknown"}, ${newShareholderId}, ${currentDate}, ${meetingId})`
            );
            
            await logToFile("properties", "Property transfer record created", LogLevel.INFO, {
                propertyId,
                fromShareholderId: oldShareholderId,
                toShareholderId: targetShareholderId,
                meetingId
            });
        } catch (transferError) {
            await logToFile("properties", "Error creating transfer record", LogLevel.ERROR, {
                error: transferError instanceof Error ? transferError.message : "Unknown error"
            });
            // Continue with property update even if transfer record fails
        }

        // Set values for property update
        // Default values - these may be overridden based on keepExistingCustomer and keepExistingService flags
        let ownerNameValue = newOwnerName || newShareholder.name;
        let ownerMailingAddressValue = newOwnerMailingAddress || property.ownerMailingAddress;
        let ownerCityStateZipValue = newOwnerCityStateZip || property.ownerCityStateZip;
        
        // Always keep customer information the same from the previous owner
        // This ensures customer info is transferred to the new owner unchanged
        let customerNameValue = property.customerName;
        let customerMailingAddressValue = property.customerMailingAddress;
        let customerCityStateZipValue = property.cityStateZip;
        
        // Default resident values (may be kept from existing property)
        let residentNameValue = newResidentName || property.residentName;
        let residentMailingAddressValue = newResidentMailingAddress || property.residentMailingAddress;
        let residentCityStateZipValue = newResidentCityStateZip || property.residentCityStateZip;

        // Log that we're keeping customer information
        await logToFile("properties", "Keeping existing customer information during transfer", LogLevel.INFO, {
            propertyId,
            customerName: customerNameValue,
            customerMailingAddress: customerMailingAddressValue
        });
        
        // If keepExistingService flag is set, keep all service address and resident information unchanged
        if (keepExistingService) {
            // Service address is never changed during transfer anyway, so we only need to keep resident info
            residentNameValue = property.residentName;
            residentMailingAddressValue = property.residentMailingAddress;
            residentCityStateZipValue = property.residentCityStateZip;
            
            await logToFile("properties", "Keeping existing service and resident information", LogLevel.INFO, {
                propertyId,
                serviceAddress: property.serviceAddress,
                residentName: residentNameValue
            });
        }

        // Use SQL for update to ensure we handle null values properly
        // We're constructing a property update statement with all the fields
        const propertyUpdate = {
            propertyId: parseInt(propertyId),
            shareholderId: targetShareholderId,
            ownerName: ownerNameValue,
            ownerMailingAddress: ownerMailingAddressValue,
            ownerCityStateZip: ownerCityStateZipValue,
            customerName: customerNameValue,
            customerMailingAddress: customerMailingAddressValue,
            cityStateZip: customerCityStateZipValue,
            residentName: residentNameValue,
            residentMailingAddress: residentMailingAddressValue,
            residentCityStateZip: residentCityStateZipValue
        };
        
        await logToFile("properties", "Property transfer update details", LogLevel.INFO, {
            propertyId,
            update: propertyUpdate
        });
        
        try {
            await db.execute(
                sql`UPDATE properties 
                SET shareholder_id = ${targetShareholderId},
                    owner_name = ${ownerNameValue},
                    owner_mailing_address = ${ownerMailingAddressValue},
                    owner_city_state_zip = ${ownerCityStateZipValue},
                    customer_name = ${customerNameValue},
                    customer_mailing_address = ${customerMailingAddressValue},
                    city_state_zip = ${customerCityStateZipValue},
                    resident_name = ${residentNameValue},
                    resident_mailing_address = ${residentMailingAddressValue},
                    resident_city_state_zip = ${residentCityStateZipValue}
                WHERE id = ${parseInt(propertyId)}`
            );
            
            await logToFile("properties", "Property updated via SQL", LogLevel.INFO, {
                propertyId,
                shareholderId: targetShareholderId
            });
        } catch (updateError) {
            await logToFile("properties", "Error updating property via SQL", LogLevel.ERROR, {
                propertyId,
                error: updateError instanceof Error ? updateError.message : "Unknown error"
            });
            
            return NextResponse.json(
                { error: "Failed to update property" },
                { status: 500 }
            )
        }

        // Fetch the updated property to return it
        const [updatedProperty] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)))

        await logToFile("properties", "Property transferred successfully", LogLevel.INFO, {
            propertyId,
            oldShareholderId,
            newShareholderId: targetShareholderId
        });

        // Check if we need to delete the old shareholder (if they have no properties left)
        try {
            // Check if the old shareholder has any remaining properties
            const [{ propertyCount }] = await db
                .select({ propertyCount: count() })
                .from(properties)
                .where(eq(properties.shareholderId, oldShareholderId))
                
            // If no properties left, clean up the shareholder record
            if (propertyCount === 0) {
                await db.delete(shareholders).where(eq(shareholders.shareholderId, oldShareholderId))
                
                await logToFile("properties", "Deleted shareholder with no properties", LogLevel.INFO, {
                    shareholderId: oldShareholderId
                });
            }
        } catch (deleteError) {
            await logToFile("properties", "Error deleting old shareholder", LogLevel.ERROR, {
                shareholderId: oldShareholderId,
                error: deleteError instanceof Error ? deleteError.message : "Unknown error"
            });
            // Continue anyway, it's not critical if shareholder cleanup fails
        }
        
        // Return the updated property
        return NextResponse.json(updatedProperty);
    } catch (error) {
        await logToFile("properties", "Error transferring property", LogLevel.ERROR, {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        
        return NextResponse.json(
            { error: "Failed to transfer property" },
            { status: 500 }
        )
    }
} 