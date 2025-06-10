"use server"

import { queryOne } from "@/lib/db"
import type { Property } from "@/types/Property"

export async function updateProperty(id: string, data: Partial<Property>): Promise<Property | null> {
    try {
        const setClause = Object.entries(data)
            .map(([key, _], index) => `${key} = $${index + 2}`)
            .join(', ');

        const values = Object.values(data);
        const queryString = `
            UPDATE properties 
            SET ${setClause}
            WHERE id = $1
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
                created_at as "createdAt"
        `;

        const property = await queryOne<Property>(queryString, [parseInt(id, 10), ...values]);

        return property;
    } catch (error) {
        console.error("Failed to update property:", error)
        return null
    }
} 