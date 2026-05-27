import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildTestMailerPdf } from "@/lib/buildTestMailerPdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Single-sample mailer PDF with fake address + barcode (production overlay layout).
 * Admin-only; same mailer template as batch generation (`MAILER_TEMPLATE_FILE_NAME` in mailerPdfConstants).
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const bytes = await buildTestMailerPdf()
        return new NextResponse(Buffer.from(bytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="mailer-layout-test.pdf"',
                "Cache-Control": "no-store",
            },
        })
    } catch (e) {
        console.error("mailer-test-pdf:", e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to build test mailer PDF" },
            { status: 500 },
        )
    }
}
