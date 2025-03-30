import { sql } from "@vercel/postgres"

export async function initDatabase() {
  console.log("Initializing database...")
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    console.log("Users table created successfully")

    // Create meetings table
    await sql`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        date TIMESTAMP NOT NULL,
        total_shareholders INTEGER DEFAULT 0,
        checked_in INTEGER DEFAULT 0
      );
    `
    console.log("Meetings table created successfully")

    // Create shareholders table
    await sql`
      CREATE TABLE IF NOT EXISTS shareholders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        shareholder_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
    console.log("Shareholders table created successfully")

    // Create properties table
    await sql`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        account TEXT NOT NULL,
        num_of TEXT,
        customer_name TEXT,
        customer_mailing_address TEXT,
        city_state_zip TEXT,
        owner_name TEXT,
        owner_mailing_address TEXT,
        owner_city_state_zip TEXT,
        resident_name TEXT,
        resident_mailing_address TEXT,
        resident_city_state_zip TEXT,
        service_address TEXT,
        checked_in BOOLEAN DEFAULT FALSE,
        shareholder_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
    console.log("Properties table created successfully")

    // Create property_transfers table
    await sql`
      CREATE TABLE IF NOT EXISTS property_transfers (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        from_shareholder_id TEXT NOT NULL,
        to_shareholder_id TEXT NOT NULL,
        transfer_date TIMESTAMP NOT NULL,
        meeting_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
    console.log("Property transfers table created successfully")

    // Add indexes for property_transfers
    await sql`
      CREATE INDEX IF NOT EXISTS idx_property_transfers_property_id ON property_transfers(property_id);
      CREATE INDEX IF NOT EXISTS idx_property_transfers_meeting_id ON property_transfers(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_property_transfers_from_shareholder_id ON property_transfers(from_shareholder_id);
      CREATE INDEX IF NOT EXISTS idx_property_transfers_to_shareholder_id ON property_transfers(to_shareholder_id);
    `
    console.log("Property transfers indexes created successfully")

    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Failed to initialize database:", error)
    throw error
  }
}