import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { logToFile, LogLevel } from "@/utils/logger"

// Define interface for properties to make TypeScript happy
export interface Property {
    id: number
    account: string
    shareholder_id: string
    service_address: string
    city_state_zip: string
    num_of: string
    owner_name: string
    owner_mailing_address: string
    owner_city_state_zip: string
    customer_name: string
    customer_mailing_address: string
    resident_name: string
    resident_mailing_address: string
    resident_city_state_zip: string
    checked_in: boolean
}

// GET endpoint for retrieving properties
export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const limit = url.searchParams.get("limit") || "100" // Default to 100 properties
        const searchTerm = url.searchParams.get("search") || ""
        const checkedInFilter = url.searchParams.get("checkedIn")
        
        await logToFile("properties", "Properties request received", LogLevel.INFO, {
            limit,
            hasSearchTerm: !!searchTerm,
            checkedInFilter
        })

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Build the query based on filters
        let whereClause = "";
        const params: any[] = [];
        let paramIndex = 1;

        if (searchTerm) {
            whereClause = `WHERE (
                service_address ILIKE $${paramIndex} OR
                owner_name ILIKE $${paramIndex} OR
                customer_name ILIKE $${paramIndex} OR
                account ILIKE $${paramIndex}
            )`;
            params.push(`%${searchTerm}%`);
            paramIndex++;
        }
        
        if (checkedInFilter === "true") {
            whereClause += whereClause ? " AND " : "WHERE ";
            whereClause += `checked_in = $${paramIndex}`;
            params.push(true);
            paramIndex++;
        } else if (checkedInFilter === "false") {
            whereClause += whereClause ? " AND " : "WHERE ";
            whereClause += `checked_in = $${paramIndex}`;
            params.push(false);
            paramIndex++;
        }
        
        // Execute the query
        const propertyList = await query<Property>(
            `SELECT * FROM properties ${whereClause} ORDER BY id DESC LIMIT $${paramIndex}`,
            [...params, parseInt(limit)]
        );

        // Log the first few properties to check checked_in values
        // console.log("First few properties from DB:", propertyList.slice(0, 3));
        // console.log("Checked-in properties count:", propertyList.filter(p => p.checked_in).length);

        await logToFile("properties", "Properties fetched successfully", LogLevel.INFO, {
            propertiesCount: propertyList.length,
            checkedInCount: propertyList.filter(p => p.checked_in).length
        })

        return NextResponse.json(propertyList)
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

// POST endpoint for creating a property
export async function POST(request: Request) {
    try {
        await logToFile("properties", "Property creation request received", LogLevel.INFO)

        // Authentication check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            await logToFile("properties", "Unauthorized access attempt", LogLevel.ERROR)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get request body
        const body = await request.json()
        
        // Log receipt of creation data (without showing sensitive data)
        await logToFile("properties", "Property creation data received", LogLevel.INFO)
        
        // Validation for minimum required fields
        if (!body.account || !body.serviceAddress || !body.shareholderId) {
            return NextResponse.json(
                { error: "Account number, service address and shareholder ID are required" },
                { status: 400 }
            )
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
        
        // Format all input values to uppercase for consistency
        const formattedData = {
            account: body.account?.trim().toUpperCase() || '',
            shareholder_id: body.shareholderId?.trim() || '',
            service_address: body.serviceAddress?.trim().toUpperCase() || '',
            city_state_zip: formatCityStateZip(body.cityStateZip),
            num_of: body.numOf?.trim() || '',
            owner_name: body.ownerName?.trim().toUpperCase() || '',
            owner_mailing_address: body.ownerMailingAddress?.trim().toUpperCase() || '',
            owner_city_state_zip: formatCityStateZip(body.ownerCityStateZip),
            customer_name: body.customerName?.trim().toUpperCase() || '',
            customer_mailing_address: body.customerMailingAddress?.trim().toUpperCase() || '',
            resident_name: body.residentName?.trim().toUpperCase() || '',
            resident_mailing_address: body.residentMailingAddress?.trim().toUpperCase() || '',
            resident_city_state_zip: formatCityStateZip(body.residentCityStateZip),
            checked_in: false, // New properties always start unchecked
        };

        // Create property
        const newProperty = await queryOne<Property>(
            `INSERT INTO properties (
                account, shareholder_id, service_address, city_state_zip, num_of,
                owner_name, owner_mailing_address, owner_city_state_zip,
                customer_name, customer_mailing_address, resident_name,
                resident_mailing_address, resident_city_state_zip, checked_in
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING *`,
            [
                formattedData.account,
                formattedData.shareholder_id,
                formattedData.service_address,
                formattedData.city_state_zip,
                formattedData.num_of,
                formattedData.owner_name,
                formattedData.owner_mailing_address,
                formattedData.owner_city_state_zip,
                formattedData.customer_name,
                formattedData.customer_mailing_address,
                formattedData.resident_name,
                formattedData.resident_mailing_address,
                formattedData.resident_city_state_zip,
                formattedData.checked_in
            ]
        );

        await logToFile("properties", "Property created successfully", LogLevel.INFO, {
            propertyId: newProperty?.id,
            account: newProperty?.account
        })

        return NextResponse.json(newProperty)
    } catch (error) {
        await logToFile("properties", "Error creating property", LogLevel.ERROR, {
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            errorType: error instanceof Error ? error.name : "Unknown type"
        })

        return NextResponse.json(
            { error: "Failed to create property" },
            { status: 500 }
        )
    }
}
