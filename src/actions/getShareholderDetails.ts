"use server"

import { query, queryOne } from "@/lib/db"
import { notFound } from "next/navigation"

export async function getShareholderDetails(shareholderId: string) {
    try {
        const [shareholder, shareholderProperties] = await Promise.all([
            queryOne<{
                id: number;
                shareholder_id: string;
                name: string;
                meeting_id: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                is_new: boolean;
                created_at: Date;
                comment: string;
            }>(
                'SELECT * FROM shareholders WHERE shareholder_id = $1',
                [shareholderId]
            ),

            query<{
                id: number;
                account: string;
                shareholder_id: string;
                num_of: string;
                customer_name: string;
                customer_mailing_address: string;
                city_state_zip: string;
                owner_name: string;
                owner_mailing_address: string;
                owner_city_state_zip: string;
                resident_name: string;
                resident_mailing_address: string;
                resident_city_state_zip: string;
                service_address: string;
                checked_in: boolean;
                created_at: Date;
            }>(
                'SELECT * FROM properties WHERE shareholder_id = $1 ORDER BY account',
                [shareholderId]
            )
        ])

        if (!shareholder) {
            notFound()
        }

        return {
            shareholder,
            properties: shareholderProperties,
        }
    } catch (error) {
        throw new Error("Failed to fetch shareholder details")
    }
}