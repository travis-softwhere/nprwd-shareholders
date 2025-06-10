import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { name } = await request.json()
    const { id } = await context.params

    // Update the shareholder name in the database
    const updatedShareholder = await queryOne<{
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
      'UPDATE shareholders SET name = $1 WHERE shareholder_id = $2 RETURNING *',
      [name, id]
    );

    if (!updatedShareholder) {
      return NextResponse.json(
        { error: 'Shareholder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating shareholder:', error)
    return NextResponse.json(
      { error: 'Failed to update shareholder' },
      { status: 500 }
    )
  }
}
