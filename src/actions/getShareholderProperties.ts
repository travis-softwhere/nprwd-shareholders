"use server"

import { query } from "@/lib/db"
import type { Property } from "@/types/Property"

export async function getShareholderProperties(shareholderId: string): Promise<Property[]> {
    try {
        const properties = await query<Property>(
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
            WHERE p.shareholder_id = $1
            ORDER BY p.account`,
            [shareholderId]
        );

        return properties;
    } catch (error) {
        console.error("Failed to fetch shareholder properties:", error)
        return []
    }
} 