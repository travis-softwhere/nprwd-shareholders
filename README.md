# NPRWD AquaShare - Shareholder Meeting Management

A web application for managing North Prairie Rural Water District shareholder meetings and property ownership.

## What it does

- **Meeting Management**: Create meetings, track attendance, generate reports
- **Shareholder Check-in**: Barcode scanning and manual check-in during meetings  
- **Property Management**: Track ownership, handle transfers between shareholders
- **Document Generation**: Create mailers with barcodes, meeting reports

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create `.env.local` with your database and authentication settings:
   ```env
   DATABASE_URL="your-postgresql-url"
   NEXTAUTH_SECRET="your-secret"
   KEYCLOAK_CLIENT_ID="your-keycloak-client"
   KEYCLOAK_CLIENT_SECRET="your-keycloak-secret"
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL (Neon)
- **Authentication**: NextAuth.js with Keycloak
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **PDF Generation**: PDF-lib, bwip-js for barcodes

## Rights & Ownership

### Copyright
© 2025 North Prairie Rural Water District (NPRWD). All rights reserved.

### License
This software is open source and available for public use. While the code is freely accessible, all intellectual property rights, including but not limited to trademarks, service marks, and proprietary methodologies, remain the property of NPRWD.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
