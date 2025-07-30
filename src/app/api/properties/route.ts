import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { properties } from "@/lib/db/schema"
import { desc, sql, and, eq, like } from "drizzle-orm"
import { logToFile, LogLevel } from "@/utils/logger"

// Define interface for properties to make TypeScript happy
export interface Property {
    id: number
    account: string
    shareholderId: string
    serviceAddress: string
    cityStateZip: string
    numOf: string
    ownerName: string
    ownerMailingAddress: string
    ownerCityStateZip: string
    customerName: string
    customerMailingAddress: string
    residentName: string
    residentMailingAddress: string
    residentCityStateZip: string
    checkedIn: boolean
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
        let whereConditions = undefined;
        
        const conditions = []
        
        // Add search condition
        if (searchTerm) {
            conditions.push(
                sql`(
                    ${properties.serviceAddress} ILIKE ${`%${searchTerm}%`} OR
                    ${properties.ownerName} ILIKE ${`%${searchTerm}%`} OR
                    ${properties.customerName} ILIKE ${`%${searchTerm}%`} OR
                    ${properties.account} ILIKE ${`%${searchTerm}%`}
                )`
            )
        }
        
        // Add checked-in filter
        if (checkedInFilter === "true") {
            conditions.push(eq(properties.checkedIn, true))
        } else if (checkedInFilter === "false") {
            conditions.push(eq(properties.checkedIn, false))
        }
        
        // Apply all conditions if any
        if (conditions.length > 0) {
            whereConditions = and(...conditions);
        }
        
        // Execute the query
        const propertyList = await db
            .select({
                id: properties.id,
                account: properties.account,
                shareholderId: properties.shareholderId,
                numOf: properties.numOf,
                customerName: properties.customerName,
                customerMailingAddress: properties.customerMailingAddress,
                cityStateZip: properties.cityStateZip,
                ownerName: properties.ownerName,
                ownerMailingAddress: properties.ownerMailingAddress,
                ownerCityStateZip: properties.ownerCityStateZip,
                residentName: properties.residentName,
                residentMailingAddress: properties.residentMailingAddress,
                residentCityStateZip: properties.residentCityStateZip,
                serviceAddress: properties.serviceAddress,
                checkedIn: properties.checkedIn,
                createdAt: properties.createdAt
            })
            .from(properties)
            .where(whereConditions)
            .limit(parseInt(limit))
            .orderBy(desc(properties.id));

        // Log the first few properties to check checkedIn values
        console.log("First few properties from DB:", propertyList.slice(0, 3));
        console.log("Checked-in properties count:", propertyList.filter(p => p.checkedIn).length);

        await logToFile("properties", "Properties fetched successfully", LogLevel.INFO, {
            propertiesCount: propertyList.length,
            checkedInCount: propertyList.filter(p => p.checkedIn).length
        })

        return NextResponse.json({ properties: propertyList })
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
            shareholderId: body.shareholderId?.trim() || '',
            serviceAddress: body.serviceAddress?.trim().toUpperCase() || '',
            cityStateZip: formatCityStateZip(body.cityStateZip),
            numOf: body.numOf?.trim() || '',
            ownerName: body.ownerName?.trim().toUpperCase() || '',
            ownerMailingAddress: body.ownerMailingAddress?.trim().toUpperCase() || '',
            ownerCityStateZip: formatCityStateZip(body.ownerCityStateZip),
            customerName: body.customerName?.trim().toUpperCase() || '',
            customerMailingAddress: body.customerMailingAddress?.trim().toUpperCase() || '',
            residentName: body.residentName?.trim().toUpperCase() || '',
            residentMailingAddress: body.residentMailingAddress?.trim().toUpperCase() || '',
            residentCityStateZip: formatCityStateZip(body.residentCityStateZip),
            checkedIn: false, // New properties always start unchecked
        };

        // Create property
        const [newProperty] = await db
            .insert(properties)
            .values(formattedData)
            .returning()

        await logToFile("properties", "Property created successfully", LogLevel.INFO, {
            propertyId: newProperty.id,
            account: newProperty.account
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
