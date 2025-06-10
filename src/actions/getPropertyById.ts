"use server"

import { queryOne } from "@/lib/db"
import type { Property } from "@/types/Property"

export async function getPropertyById(id: string): Promise<Property | null> {
    try {
        const property = await queryOne<Property>(
            `SELECT 
                p.id,
                p.account,
                p.num_of as "numOf",
                p.customer_name as "customerName",
                p.customer_mailing_address as "customerMailingAddress",
                p.city_state_zip as "cityStateZip",
                p.owner_name as "ownerName",
                p.owner_mailing_address as "ownerMailingAddress",
                p.owner_city_state_zip as "ownerCityStateZip",
                p.resident_name as "residentName",
                p.resident_mailing_address as "residentMailingAddress",
                p.resident_city_state_zip as "residentCityStateZip",
                p.service_address as "serviceAddress",
                p.checked_in as "checkedIn",
                p.shareholder_id as "shareholderId",
                p.created_at as "createdAt"
            FROM properties p
            WHERE p.id = $1`,
            [parseInt(id, 10)]
        );

        return property;
    } catch (error) {
        console.error("Failed to fetch property:", error)
        return null
    }
} 