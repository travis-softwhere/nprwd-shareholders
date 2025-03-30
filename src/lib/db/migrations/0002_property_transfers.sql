-- Create property_transfers table
CREATE TABLE IF NOT EXISTS property_transfers (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    from_shareholder_id TEXT NOT NULL,
    to_shareholder_id TEXT NOT NULL,
    transfer_date TIMESTAMP NOT NULL,
    meeting_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_property_transfers_property_id ON property_transfers(property_id);
CREATE INDEX IF NOT EXISTS idx_property_transfers_meeting_id ON property_transfers(meeting_id);
CREATE INDEX IF NOT EXISTS idx_property_transfers_from_shareholder_id ON property_transfers(from_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_property_transfers_to_shareholder_id ON property_transfers(to_shareholder_id); 