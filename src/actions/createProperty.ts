"use server"

import { queryOne } from "@/lib/db"
import type { Property } from "@/types/Property"

export async function createProperty(data: Omit<Property, 'id' | 'createdAt'>): Promise<Property | null> {
    try {
        const property = await queryOne<Property>(
            `INSERT INTO properties (
                account,
                num_of,
                customer_name,
                customer_mailing_address,
                city_state_zip,
                owner_name,
                owner_mailing_address,
                owner_city_state_zip,
                resident_name,
                resident_mailing_address,
                resident_city_state_zip,
                service_address,
                checked_in,
                shareholder_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING 
                id,
                account,
                num_of as "numOf",
                customer_name as "customerName",
                customer_mailing_address as "customerMailingAddress",
                city_state_zip as "cityStateZip",
                owner_name as "ownerName",
                owner_mailing_address as "ownerMailingAddress",
                owner_city_state_zip as "ownerCityStateZip",
                resident_name as "residentName",
                resident_mailing_address as "residentMailingAddress",
                resident_city_state_zip as "residentCityStateZip",
                service_address as "serviceAddress",
                checked_in as "checkedIn",
                shareholder_id as "shareholderId",
                created_at as "createdAt"`,
            [
                data.account,
                data.numOf,
                data.customerName,
                data.customerMailingAddress,
                data.cityStateZip,
                data.ownerName,
                data.ownerMailingAddress,
                data.ownerCityStateZip,
                data.residentName,
                data.residentMailingAddress,
                data.residentCityStateZip,
                data.serviceAddress,
                data.checkedIn,
                data.shareholderId
            ]
        );

        return property;
    } catch (error) {
        console.error("Failed to create property:", error)
        return null
    }
} 