"use server"

import { query, queryOne } from "@/lib/db"
import type { Property } from "@/types/Property"

interface PropertiesListResponse {
    properties: Property[];
    totalProperties: number;
}

export async function getPropertiesList(
    page: number = 1,
    itemsPerPage: number = 25,
    searchTerm?: string,
    checkedInFilter?: boolean
): Promise<PropertiesListResponse> {
    const offset = (page - 1) * itemsPerPage

    try {
        let queryString = `
            SELECT 
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
            LEFT JOIN shareholders s ON p.shareholder_id = s.shareholder_id
        `;

        const queryParams: any[] = [];
        const conditions: string[] = [];

        if (searchTerm) {
            conditions.push(`(
                p.account ILIKE $${queryParams.length + 1} OR
                p.service_address ILIKE $${queryParams.length + 1} OR
                p.customer_name ILIKE $${queryParams.length + 1} OR
                p.owner_name ILIKE $${queryParams.length + 1} OR
                p.resident_name ILIKE $${queryParams.length + 1}
            )`);
            queryParams.push(`%${searchTerm}%`);
        }

        if (checkedInFilter !== undefined) {
            conditions.push(`p.checked_in = $${queryParams.length + 1}`);
            queryParams.push(checkedInFilter);
        }

        if (conditions.length > 0) {
            queryString += ` WHERE ${conditions.join(' AND ')}`;
        }

        queryString += ` ORDER BY p.account LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(itemsPerPage, offset);

        const properties = await query<Property>(queryString, queryParams);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as count
            FROM properties p
            LEFT JOIN shareholders s ON p.shareholder_id = s.shareholder_id
        `;

        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }

        const totalResult = await queryOne<{ count: number }>(
            countQuery,
            queryParams.slice(0, -2) // Remove LIMIT and OFFSET params
        );
        const totalProperties = totalResult?.count || 0;

        return {
            properties,
            totalProperties,
        }
    } catch (error) {
        console.error("Failed to fetch properties list:", error)
        return { properties: [], totalProperties: 0 }
    }
} 