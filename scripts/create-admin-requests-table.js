const { sql } = require('@vercel/postgres');

async function createAdminRequestsTable() {
  try {
    console.log('Creating admin_requests table...');
    
    // Create admin_requests table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_requests (
        id SERIAL PRIMARY KEY,
        shareholder_id TEXT NOT NULL,
        shareholder_name TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'pending',
        completed_by TEXT,
        completed_at TIMESTAMP,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Add indexes for admin_requests
    await sql`
      CREATE INDEX IF NOT EXISTS idx_admin_requests_shareholder_id ON admin_requests(shareholder_id);
      CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_requests(status);
      CREATE INDEX IF NOT EXISTS idx_admin_requests_requested_at ON admin_requests(requested_at);
    `;

    console.log('admin_requests table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin_requests table:', error);
    process.exit(1);
  }
}

createAdminRequestsTable();
