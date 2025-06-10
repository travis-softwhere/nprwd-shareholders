"use server"

import { query, queryOne } from "@/lib/db"
import type { Shareholder } from "@/types/shareholder"

export async function getShareholderById(id: string): Promise<Shareholder | null> {
    try {
        const shareholder = await queryOne<{
            id: number;
            name: string;
            shareholder_id: string;
            owner_mailing_address: string;
            owner_city_state_zip: string;
            is_new: boolean;
            total_properties: number;
            checked_in_properties: number;
        }>(
            `SELECT 
                s.id,
                s.name,
                s.shareholder_id,
                s.owner_mailing_address,
                s.owner_city_state_zip,
                s.is_new,
                COUNT(s.id) as total_properties,
                COUNT(CASE WHEN p.checked_in THEN 1 ELSE NULL END) as checked_in_properties
            FROM shareholders s
            LEFT JOIN properties p ON s.shareholder_id = p.shareholder_id
            WHERE s.id = $1
            GROUP BY s.id`,
            [parseInt(id, 10)]
        );

        if (!shareholder) {
            return null;
        }

        return {
            id: shareholder.id,
            name: shareholder.name,
            shareholderId: shareholder.shareholder_id,
            ownerMailingAddress: shareholder.owner_mailing_address,
            ownerCityStateZip: shareholder.owner_city_state_zip,
            isNew: shareholder.is_new,
            totalProperties: shareholder.total_properties,
            checkedInProperties: shareholder.checked_in_properties
        };
    } catch (error) {
        console.error("Failed to fetch shareholder:", error)
        return null
    }
} 