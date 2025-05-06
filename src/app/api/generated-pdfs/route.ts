import { NextResponse } from "next/server"
import { list, del } from "@vercel/blob"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get("meetingId")

    if (!meetingId) {
      return new NextResponse("Meeting ID is required", { status: 400 })
    }

    // List all blobs in the meeting's folder
    const { blobs } = await list({
      prefix: `mailers/${meetingId}/`,
    })

    console.log(blobs)
    // Transform the blobs into our PDF format
    const pdfs = blobs.map(blob => ({
      url: blob.url,
      fileName: blob.pathname.split("/").pop() || "",
      createdAt: blob.uploadedAt,
      size: blob.size,
    }))

    return NextResponse.json({ pdfs })
  } catch (error) {
    console.error("Error fetching PDFs:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { url, meetingId } = body

    if (!meetingId) {
      return new NextResponse("Meeting ID is required", { status: 400 })
    }

    if (url) {
      // Delete a single blob
      console.log('Deleting single blob:', url)
      await del(url)
      return new NextResponse(null, { status: 204 })
    } else {
      // Delete all blobs for the meeting
      console.log('Deleting all blobs for meeting:', meetingId)
      const { blobs } = await list({ prefix: `mailers/${meetingId}/` })
      console.log('Found blobs to delete:', blobs.map(b => b.url))
      for (const blob of blobs) {
        await del(blob.url)
        console.log('Deleted blob:', blob.url)
      }
      return new NextResponse(null, { status: 204 })
    }
  } catch (error) {
    console.error("Error deleting PDF(s):", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 