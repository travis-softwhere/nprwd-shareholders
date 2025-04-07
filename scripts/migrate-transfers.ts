import { createClient } from '@vercel/postgres'

async function migrateTransfers() {
    const client = createClient({
        connectionString: 'postgresql://neondb_owner:npg_rsz3q9bADoeE@ep-curly-sun-a59njuxa-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
    });

    try {
        // Create property_transfers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS property_transfers (
                id SERIAL PRIMARY KEY,
                property_id INTEGER NOT NULL REFERENCES properties(id),
                from_shareholder_id TEXT NOT NULL,
                to_shareholder_id TEXT NOT NULL,
                transfer_date TIMESTAMP NOT NULL,
                meeting_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Add indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_property_transfers_property_id ON property_transfers(property_id);
        `)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_property_transfers_meeting_id ON property_transfers(meeting_id);
        `)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_property_transfers_from_shareholder_id ON property_transfers(from_shareholder_id);
        `)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_property_transfers_to_shareholder_id ON property_transfers(to_shareholder_id);
        `)

        return 0 // Success
    } catch (error) {
        return 1 // Error
    } finally {
        await client.end()
        process.exit(0)
    }
}

migrateTransfers()
  .then(exitCode => {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  })
  .catch(() => {
    process.exit(1);
  }) 