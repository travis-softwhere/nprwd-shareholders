const { sql } = require('@vercel/postgres');

async function createUndoRequestsTable() {
  try {
    console.log('Creating undo_requests table...');
    
    // Create undo_requests table
    await sql`
      CREATE TABLE IF NOT EXISTS undo_requests (
        id SERIAL PRIMARY KEY,
        shareholder_id TEXT NOT NULL,
        shareholder_name TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TIMESTAMP,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Add indexes for undo_requests
    await sql`
      CREATE INDEX IF NOT EXISTS idx_undo_requests_shareholder_id ON undo_requests(shareholder_id);
      CREATE INDEX IF NOT EXISTS idx_undo_requests_status ON undo_requests(status);
      CREATE INDEX IF NOT EXISTS idx_undo_requests_requested_at ON undo_requests(requested_at);
    `;

    console.log('undo_requests table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating undo_requests table:', error);
    process.exit(1);
  }
}

createUndoRequestsTable();
