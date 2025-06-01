import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shareholders } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { name } = await request.json()
    const { id } = await context.params

    // Update the shareholder name in the database
    await db.update(shareholders)
      .set({ name })
      .where(eq(shareholders.shareholderId, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating shareholder:', error)
    return NextResponse.json(
      { error: 'Failed to update shareholder' },
      { status: 500 }
    )
  }
}
