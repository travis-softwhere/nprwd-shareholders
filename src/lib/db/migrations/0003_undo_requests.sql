-- Create undo_requests table
CREATE TABLE IF NOT EXISTS undo_requests (
    id SERIAL PRIMARY KEY,
    shareholder_id TEXT NOT NULL,
    shareholder_name TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by TEXT,
    approved_at TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_undo_requests_shareholder_id ON undo_requests(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_undo_requests_status ON undo_requests(status);
CREATE INDEX IF NOT EXISTS idx_undo_requests_requested_at ON undo_requests(requested_at);
