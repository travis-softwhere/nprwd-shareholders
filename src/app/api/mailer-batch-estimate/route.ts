import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getMailerBatchSizingForApi } from "@/lib/mailerBatchSizing"

export const dynamic = "force-dynamic"

/**
 * Returns measured bytes-per-mailer, disk-estimate fields, and dynamic `pagesPerBatch` (~2.5 GiB cap per file).
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const sizing = await getMailerBatchSizingForApi()
        return NextResponse.json({
            bytesPerMailer: sizing.bytesPerMailer,
            maxBatchBytes: sizing.maxBatchBytes,
            pagesPerBatch: sizing.pagesPerBatch,
            maxMailerFileBytes: sizing.maxMailerFileBytes,
            maxMailerFileGiB: sizing.maxMailerFileGiB,
        })
    } catch (e) {
        console.error("mailer-batch-estimate:", e)
        return NextResponse.json({ error: "Failed to estimate batch sizing" }, { status: 500 })
    }
}
