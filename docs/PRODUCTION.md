# Production Setup Guide

This document outlines the steps required to prepare and deploy the application in a production environment.

## Environment Setup

1. Create a new `.env.production` file with production-specific values then input them into the vercel => settigs => environment variables 
2. Ensure the following environment variables are set properly:

```
# Set NODE_ENV to production for proper behavior
NODE_ENV=production

# Controlling Next.js logging (options: fatal, error, warn, info, debug, trace)
NEXT_LOG_LEVEL=error

#Neon settings - use production db
DATABASE_URL_DEV=
DATABASE_URL_UNPOOLED=
PGHOST=
PGHOST_UNPOOLED=
PGUSER=
PGDATABASE=
PGPASSWORD=
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
POSTGRES_USER=
POSTGRES_HOST=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=
POSTGRES_URL_NO_SSL=
POSTGRES_PRISMA_URL=

# Keycloak settings - use production realm and valid credentials
KEYCLOAK_CLIENT_ID=your-production-client-id
KEYCLOAK_CLIENT_SECRET=your-production-client-secret
KEYCLOAK_ISSUER=https://your-production-keycloak-url/realms/your-production-realm
KEYCLOAK_REALM=your-production-realm

# SMTP settings - use production email credentials
SMTP_HOST=your-production-smtp-host
SMTP_USER=your-production-smtp-user
SMTP_PASSWORD=your-production-smtp-password
EMAIL_FROM=your-production-from-email
SMTP_PORT=465
SMTP_SECURE=true

# Base URL for the application in production
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com

# Strong, unique secrets for production
NEXTAUTH_SECRET=generate-a-strong-random-secret-here
JWT_SECRET=generate-another-strong-random-secret-here

# Database connection - use production database
DATABASE_URL=your-production-database-url
```

## Security Considerations

1. **Console Logging**: All console logs have been removed or disabled in production to prevent sensitive information leakage.

2. **Framework Logging**: Next.js framework-level logs are configured to only show errors in production via the `NEXT_LOG_LEVEL` environment variable.

3. **TLS Certificate Validation**: In production, TLS certificate validation is enforced. This ensures secure connections to external services.

4. **Error Handling**: Error messages are properly sanitized in production to prevent exposing implementation details.

5. **API Route Security**: All API routes have been updated to use secure logging practices that prevent sensitive information from appearing in logs:
   - No JWT tokens or password reset URLs in logs
   - No full email addresses (only domains are logged)
   - No user IDs or personal information
   - Structured logging with appropriate log levels

## API Routes and Sensitive Data

API routes that handle sensitive data (like `/api/create-employee` and `/api/reset-password`) have been updated to:

1. Use the `logToFile` utility instead of direct console.log statements
2. Redact sensitive information like:
   - Full email addresses (only domains are logged)
   - JWT tokens and reset links
   - User IDs and personal details
   - Password information

3. Ensure logs are properly structured with:
   - Appropriate log levels (INFO, ERROR, etc.)
   - Context about the operation without exposing sensitive details
   - Error information without stack traces in production

## Controlling Framework Logs

In addition to our custom logging, Next.js generates its own framework-level logs. To control these in production:

1. Set the `NEXT_LOG_LEVEL` environment variable to `error` to only show critical issues.

2. Add the following configuration to your Next.js config if needed:

   ```javascript
   // next.config.js
   module.exports = {
     // Your existing config...
     
     // Production-specific settings
     ...(process.env.NODE_ENV === 'production' && {
       logging: {
         level: process.env.NEXT_LOG_LEVEL || 'error',
       },
     }),
   };
   ```

3. On Vercel, you can configure additional log filtering in the Vercel dashboard under Project Settings > Logs.

## Required Production Certificates

1. Ensure your Keycloak instance has proper SSL certificates installed. The application will verify these certificates in production.

2. For any custom domains, ensure proper SSL certificates are configured.

## Deployment Process

1. Set the required environment variables on your hosting platform (Vercel, AWS, etc.)
2. Build the application for production:
   ```
   npm run build
   ```
3. Deploy the built application to your hosting platform

## Verification

After deployment, verify that:

1. Authentication flows work properly
2. API calls to Keycloak and other external services succeed
3. No sensitive information appears in logs
4. Email functionality works with production credentials

## Troubleshooting

If you encounter issues in production:

1. Check that all environment variables are set correctly
2. Verify TLS/SSL certificates for all external services
3. Ensure firewall rules allow necessary connections
4. Review production logs for any errors (not console logs, but server logs) 