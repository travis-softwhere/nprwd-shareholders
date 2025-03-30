import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { properties } from "@/lib/db/schema"
import { eq, sql, and, ilike, or } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logToFile, LogLevel } from "@/utils/logger"

export async function GET(request: Request) {
    try {
        await logToFile("properties", "Properties list request received", LogLevel.INFO)

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const shareholderId = searchParams.get("shareholderId")
        const search = searchParams.get("search")
        const checkedIn = searchParams.get("checkedIn") === "true"

        await logToFile("properties", "Query parameters parsed", LogLevel.INFO, {
            page,
            limit,
            hasShareholderId: !!shareholderId,
            hasSearch: !!search,
            checkedIn
        })

        // Build where conditions
        const whereConditions = []

        if (shareholderId) {
            whereConditions.push(eq(properties.shareholderId, shareholderId))
        }

        if (search) {
            whereConditions.push(
                or(
                    ilike(properties.account, `%${search}%`),
                    ilike(properties.customerName, `%${search}%`),
                    ilike(properties.serviceAddress, `%${search}%`)
                )
            )
        }

        if (checkedIn !== null) {
            whereConditions.push(eq(properties.checkedIn, checkedIn))
        }

        // Get total count
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(properties)
            .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

        // Get paginated results
        const results = await db
            .select()
            .from(properties)
            .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
            .limit(limit)
            .offset((page - 1) * limit)

        await logToFile("properties", "Properties fetched successfully", LogLevel.INFO, {
            totalCount: count,
            returnedCount: results.length
        })

        // Return response
        return NextResponse.json({
            properties: results,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        })

    } catch (error) {
        await logToFile("properties", "Error fetching properties", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        })

        return NextResponse.json(
            { error: "Failed to fetch properties" },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        await logToFile("properties", "Create property request received", LogLevel.INFO);

        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        
        // Log the exact raw property data received
        console.log("RECEIVED RAW PROPERTY DATA:", JSON.stringify(body, null, 2));
        await logToFile("properties", "Received raw property data", LogLevel.INFO, {
            rawData: JSON.stringify(body)
        });

        const { 
            shareholderId, 
            account, 
            serviceAddress, 
            ownerName, 
            customerName, 
            numOf, 
            customerMailingAddress, 
            cityStateZip, 
            ownerMailingAddress, 
            ownerCityStateZip, 
            residentName, 
            residentMailingAddress, 
            residentCityStateZip,
            checkedIn = false
        } = body;

        // Validate required fields
        if (!shareholderId || !account) {
            await logToFile("properties", "Missing required fields", LogLevel.ERROR, {
                hasShareholderId: !!shareholderId,
                hasAccount: !!account,
            });
            return NextResponse.json({ error: "Shareholder ID and account number are required" }, { status: 400 });
        }

        // Format account number consistently (if not already formatted)
        let formattedAccount = account;
        if (!account.includes('-')) {
            // Format like "0000000001-00" as in examples
            formattedAccount = account.padStart(10, '0') + '-00';
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

        // Format names consistently in uppercase
        const formattedOwnerName = ownerName ? ownerName.trim().toUpperCase() : '';
        const formattedCustomerName = customerName ? customerName.trim().toUpperCase() : '';
        const formattedResidentName = residentName ? residentName.trim().toUpperCase() : '';
        
        // Format addresses consistently - ensure all text is uppercase
        const formattedServiceAddress = serviceAddress ? serviceAddress.trim().toUpperCase() : '';
        const formattedCustomerMailingAddress = customerMailingAddress ? customerMailingAddress.trim().toUpperCase() : '';
        const formattedCityStateZip = cityStateZip ? formatCityStateZip(cityStateZip) : '';
        const formattedOwnerMailingAddress = ownerMailingAddress ? ownerMailingAddress.trim().toUpperCase() : '';
        const formattedOwnerCityStateZip = ownerCityStateZip ? formatCityStateZip(ownerCityStateZip) : '';
        const formattedResidentMailingAddress = residentMailingAddress ? residentMailingAddress.trim().toUpperCase() : '';
        const formattedResidentCityStateZip = residentCityStateZip ? formatCityStateZip(residentCityStateZip) : '';
        
        // Create new property with properly formatted data
        const propertyData = {
            account: formattedAccount,
            shareholderId,
            serviceAddress: formattedServiceAddress,
            ownerName: formattedOwnerName,
            customerName: formattedCustomerName,
            numOf: numOf || '',
            customerMailingAddress: formattedCustomerMailingAddress,
            cityStateZip: formattedCityStateZip,
            ownerMailingAddress: formattedOwnerMailingAddress,
            ownerCityStateZip: formattedOwnerCityStateZip,
            residentName: formattedResidentName,
            residentMailingAddress: formattedResidentMailingAddress,
            residentCityStateZip: formattedResidentCityStateZip,
            checkedIn: !!checkedIn
        };
        
        // Log the final property data that will be inserted
        console.log("FINAL PROPERTY DATA FOR DB:", JSON.stringify(propertyData, null, 2));
        await logToFile("properties", "Final property data for insertion", LogLevel.INFO, {
            propertyData: JSON.stringify(propertyData)
        });

        const [newProperty] = await db
            .insert(properties)
            .values(propertyData)
            .returning();

        // Log the created property returned from the database
        console.log("CREATED PROPERTY:", JSON.stringify(newProperty, null, 2));
        await logToFile("properties", "Property created successfully", LogLevel.INFO, {
            propertyId: newProperty.id,
            shareholderId,
            propertyData: JSON.stringify(newProperty),
            createdAt: newProperty.createdAt
        });

        return NextResponse.json(newProperty);
    } catch (error) {
        console.error("Error creating property:", error);
        await logToFile("properties", "Error creating property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type",
            stack: error instanceof Error ? error.stack : undefined
        });

        return NextResponse.json(
            { error: "Failed to create property" },
            { status: 500 }
        );
    }
}
