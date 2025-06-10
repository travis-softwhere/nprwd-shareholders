"use server"

import { queryOne } from "@/lib/db"
import type { Shareholder } from "@/types/shareholder"

export async function updateShareholderName(id: string, name: string): Promise<Shareholder | null> {
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
            `UPDATE shareholders 
            SET name = $1 
            WHERE id = $2
            RETURNING 
                id,
                name,
                shareholder_id,
                owner_mailing_address,
                owner_city_state_zip,
                is_new,
                (SELECT COUNT(*) FROM properties WHERE shareholder_id = shareholders.shareholder_id) as total_properties,
                (SELECT COUNT(*) FROM properties WHERE shareholder_id = shareholders.shareholder_id AND checked_in = true) as checked_in_properties`,
            [name, parseInt(id, 10)]
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
        console.error("Failed to update shareholder name:", error)
        return null
    }
} 