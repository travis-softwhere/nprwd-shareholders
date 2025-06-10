"use server"

import { queryOne } from "@/lib/db"
import type { Shareholder } from "@/types/shareholder"

export async function createShareholder(data: Omit<Shareholder, 'id' | 'totalProperties' | 'checkedInProperties'>): Promise<Shareholder | null> {
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
            `INSERT INTO shareholders (
                name,
                shareholder_id,
                owner_mailing_address,
                owner_city_state_zip,
                is_new
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING 
                id,
                name,
                shareholder_id,
                owner_mailing_address,
                owner_city_state_zip,
                is_new,
                0 as total_properties,
                0 as checked_in_properties`,
            [
                data.name,
                data.shareholderId,
                data.ownerMailingAddress,
                data.ownerCityStateZip,
                data.isNew
            ]
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
        console.error("Failed to create shareholder:", error)
        return null
    }
} 