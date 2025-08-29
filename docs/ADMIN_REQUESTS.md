# Admin Requests Feature

## Overview

The Admin Requests feature allows users to send requests to administrators from the benefit unit owner details page. These requests are created from the comments section and can be reviewed and processed by admins.

## Database Schema

### admin_requests Table

```sql
CREATE TABLE admin_requests (
    id SERIAL PRIMARY KEY,
    shareholder_id TEXT NOT NULL,
    shareholder_name TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rejected'
    completed_by TEXT,
    completed_at TIMESTAMP,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### POST /api/admin-requests
Creates a new admin request.

**Request Body:**
```json
{
  "shareholderId": "string",
  "shareholderName": "string", 
  "reason": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin request submitted successfully",
  "request": { ... }
}
```

### GET /api/admin-requests
Fetches all admin requests (admin only).

**Query Parameters:**
- `status` (optional): Filter by status ('pending', 'completed', 'rejected')

**Response:**
```json
{
  "success": true,
  "requests": [...]
}
```

### PUT /api/admin-requests/[id]
Updates an admin request status (admin only).

**Request Body:**
```json
{
  "action": "complete" | "reject"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin request completed/rejected successfully"
}
```

## Components

### ShareholderCommentBox
Enhanced with a "Send Request to Admin" button that:
- Validates that a comment exists before sending
- Sends the comment content as the request reason
- Shows loading state and success/error messages

### AdminRequestsList
Displays admin requests in the admin panel with:
- Separate sections for pending and processed requests
- Action buttons to complete or reject requests
- Confirmation dialogs for actions
- Real-time status updates

## Usage

1. **Creating a Request:**
   - Navigate to a benefit unit owner details page
   - Enter a comment in the comment box
   - Click "Send Request to Admin"
   - The request will be sent with the comment as the reason

2. **Processing Requests (Admin):**
   - Navigate to the admin panel
   - View the "Admin Requests" section
   - Click "Complete" or "Reject" on pending requests
   - Confirm the action in the dialog

## Status Flow

1. **pending** - Initial state when request is created
2. **completed** - Admin has completed the request
3. **rejected** - Admin has rejected the request

## Security

- Only authenticated users can create requests
- Only admin users can view and process requests
- All actions are logged for audit purposes

## Migration

To set up the admin_requests table, run:

```bash
node scripts/create-admin-requests-table.js
```

Or manually execute the SQL from `src/lib/db/migrations/0004_admin_requests.sql`.
