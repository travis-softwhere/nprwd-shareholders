"use server"

import { db } from "@/lib/db"
import { shareholders, properties } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

export async function getShareholderDetails(shareholderId: string) {
    try {
        const [shareholder, shareholderProperties] = await Promise.all([
            db
                .select()
                .from(shareholders)
                .where(eq(shareholders.shareholderId, shareholderId))
                .then((results) => results[0]),

            db.select().from(properties).where(eq(properties.shareholderId, shareholderId)).orderBy(properties.account),
        ])

        if (!shareholder) {
            notFound()
        }

        return {
            shareholder,
            properties: shareholderProperties,
        }
    } catch (error) {
        console.error("Error fetching shareholder details:", error)
        throw new Error("Failed to fetch shareholder details")
    }
}