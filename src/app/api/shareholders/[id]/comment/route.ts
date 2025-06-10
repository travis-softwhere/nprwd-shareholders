import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const result = await queryOne<{ comment: string }>(
      'SELECT comment FROM shareholders WHERE shareholder_id = $1',
      [id]
    )
    if (!result) {
      return NextResponse.json({ error: 'Shareholder not found' }, { status: 404 })
    }
    return NextResponse.json({ comment: result.comment || '' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { comment } = await request.json()
    await query(
      'UPDATE shareholders SET comment = $1 WHERE shareholder_id = $2',
      [comment, id]
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}
