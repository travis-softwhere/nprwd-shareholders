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
            newOwnerName, 
            newOwnerMailingAddress, 
            newOwnerCityStateZip,
            newCustomerName,
            newCustomerMailingAddress,
            newCustomerCityStateZip,
            newResidentName,
            newResidentMailingAddress,
            newResidentCityStateZip
        } = body

        if (!newShareholderId) {
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
            .where(eq(shareholders.shareholderId, newShareholderId))

        if (!newShareholder) {
            await logToFile("properties", "Shareholder not found for transfer", LogLevel.ERROR, {
                shareholderId: newShareholderId
            })
            return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
        }

        // Get the meeting ID from the new shareholder record
        const meetingId = newShareholder.meetingId;
        
        // Try to find existing properties for the new shareholder to get address information
        const existingProperties = await db
            .select()
            .from(properties)
            .where(eq(properties.shareholderId, newShareholderId));
            
        console.log(`Found ${existingProperties.length} existing properties for shareholder ${newShareholderId}`);
            
        // Get address information from existing property if available
        let existingOwnerMailingAddress, existingOwnerCityStateZip;
        let existingCustomerMailingAddress, existingCustomerCityStateZip;
        let existingResidentMailingAddress, existingResidentCityStateZip;
        
        if (existingProperties.length > 0) {
            // Use the most recent property for address info
            const existingProperty = existingProperties[0];
            
            // Log all available existing properties to debug
            existingProperties.forEach((prop, index) => {
                console.log(`Existing property ${index+1}:`, {
                    id: prop.id,
                    account: prop.account,
                    ownerMailingAddress: prop.ownerMailingAddress,
                    customerMailingAddress: prop.customerMailingAddress,
                    residentMailingAddress: prop.residentMailingAddress
                });
            });
            
            existingOwnerMailingAddress = existingProperty.ownerMailingAddress;
            existingOwnerCityStateZip = existingProperty.ownerCityStateZip;
            
            existingCustomerMailingAddress = existingProperty.customerMailingAddress;
            existingCustomerCityStateZip = existingProperty.cityStateZip;
            
            existingResidentMailingAddress = existingProperty.residentMailingAddress;
            existingResidentCityStateZip = existingProperty.residentCityStateZip;
            
            console.log("Using address info from existing property:", {
                existingPropertyId: existingProperty.id,
                existingOwnerMailingAddress,
                existingCustomerMailingAddress,
                existingResidentMailingAddress
            });
            
            await logToFile("properties", "Found existing properties for new shareholder", LogLevel.INFO, {
                shareholderId: newShareholderId,
                propertiesCount: existingProperties.length,
                existingPropertyId: existingProperty.id,
                existingOwnerMailingAddress,
                existingCustomerMailingAddress,
                existingResidentMailingAddress
            });
        } else {
            console.log("No existing properties found for shareholder, will use service address");
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
                toShareholderId: newShareholderId,
                meetingId
            });
        } catch (transferError) {
            console.error("Error creating transfer record:", transferError);
            await logToFile("properties", "Error creating transfer record", LogLevel.ERROR, {
                error: transferError instanceof Error ? transferError.message : "Unknown error"
            });
            // Continue with property update even if transfer record fails
        }

        // Set address values for update
        // Only change the shareholder ID, owner/customer names, and resident information
        // Keep original owner/customer addresses unchanged
        const ownerNameValue = newOwnerName || newShareholder.name;
        const ownerMailingAddressValue = property.ownerMailingAddress; // Keep unchanged
        const ownerCityStateZipValue = property.ownerCityStateZip; // Keep unchanged
        const customerNameValue = newCustomerName || newOwnerName || newShareholder.name;
        const customerMailingAddressValue = property.customerMailingAddress; // Keep unchanged
        const customerCityStateZipValue = property.cityStateZip; // Keep unchanged
        const residentNameValue = newResidentName || newOwnerName || newShareholder.name;
        const residentMailingAddressValue = existingResidentMailingAddress || property.serviceAddress;
        const residentCityStateZipValue = existingResidentCityStateZip || property.cityStateZip;

        // Log the values to be updated
        console.log("UPDATING RESIDENT ADDRESS ONLY:", {
            usingExistingAddresses: existingProperties.length > 0,
            ownerMailingAddress: "Keeping original: " + property.ownerMailingAddress,
            customerMailingAddress: "Keeping original: " + property.customerMailingAddress,
            newResidentMailingAddress: residentMailingAddressValue,
            oldResidentMailingAddress: property.residentMailingAddress
        });

        // Update the property using direct SQL to ensure all fields are updated
        try {
            await db.execute(
                sql`UPDATE properties SET 
                    shareholder_id = ${newShareholderId},
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
            
            console.log("SQL UPDATE COMPLETED");
            await logToFile("properties", "Property updated via SQL", LogLevel.INFO, {
                propertyId
            });
        } catch (updateError) {
            console.error("Error updating property via SQL:", updateError);
            await logToFile("properties", "Error updating property via SQL", LogLevel.ERROR, {
                error: updateError instanceof Error ? updateError.message : "Unknown error"
            });
            throw updateError; // Re-throw to handle in outer catch
        }

        // Get the updated property to return
        const [updatedProperty] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, parseInt(propertyId)));

        // Verify that the mailing addresses were updated correctly
        await logToFile("properties", "Property transferred successfully", LogLevel.INFO, {
            propertyId,
            newShareholderId,
            beforeOwnerName: property.ownerName,
            afterOwnerName: updatedProperty.ownerName,
            beforeCustomerMailingAddress: property.customerMailingAddress,
            afterCustomerMailingAddress: updatedProperty.customerMailingAddress,
            beforeResidentMailingAddress: property.residentMailingAddress,
            afterResidentMailingAddress: updatedProperty.residentMailingAddress,
            existingSharedCustomerMailingAddress: existingCustomerMailingAddress,
            existingSharedResidentMailingAddress: existingResidentMailingAddress
        });

        // Check if the old shareholder has any properties left
        const [{ value: propertiesCount }] = await db
            .select({ value: count() })
            .from(properties)
            .where(eq(properties.shareholderId, oldShareholderId));

        // If no properties left, delete the old shareholder
        if (propertiesCount === 0) {
            try {
                await db.delete(shareholders)
                    .where(eq(shareholders.shareholderId, oldShareholderId));
                
                await logToFile("properties", "Deleted shareholder with no properties", LogLevel.INFO, {
                    deletedShareholderId: oldShareholderId
                });
            } catch (deleteError) {
                console.error("Error deleting old shareholder:", deleteError);
                await logToFile("properties", "Error deleting old shareholder", LogLevel.ERROR, {
                    error: deleteError instanceof Error ? deleteError.message : "Unknown error"
                });
                // Continue even if we can't delete the shareholder
            }
        }

        return NextResponse.json(updatedProperty)
    } catch (error) {
        const resolvedParams = await params;
        const propertyId = resolvedParams.id;
        
        console.error("Error transferring property:", error)
        await logToFile("properties", "Error transferring property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            propertyId
        })

        return NextResponse.json(
            { error: "Failed to transfer property" },
            { status: 500 }
        )
    }
} 