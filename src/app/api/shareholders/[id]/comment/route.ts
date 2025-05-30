import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shareholders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const result = await db.select({ comment: shareholders.comment })
      .from(shareholders)
      .where(eq(shareholders.shareholderId, id))
      .limit(1)
    if (!result.length) {
      return NextResponse.json({ error: 'Shareholder not found' }, { status: 404 })
    }
    return NextResponse.json({ comment: result[0].comment || '' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { comment } = await request.json()
    await db.update(shareholders)
      .set({ comment })
      .where(eq(shareholders.shareholderId, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}
