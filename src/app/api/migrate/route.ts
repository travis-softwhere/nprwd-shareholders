import { NextResponse } from "next/server"
import { runMigration } from "@/lib/db/migrate"

export async function GET() {
    try {
        console.log("Manual migration triggered")
        const result = await runMigration()
        if (result.success) {
            return NextResponse.json({ success: true, message: "Migration completed successfully" })
        } else {
            console.error("Migration failed:", result.error)
            return NextResponse.json(
                { success: false, error: "Migration failed. Check server logs for details." },
                { status: 500 },
            )
        }
    } catch (error) {
        console.error("Migration failed:", error)
        return NextResponse.json({ error: "Migration failed. Check server logs for details." }, { status: 500 })
    }
}